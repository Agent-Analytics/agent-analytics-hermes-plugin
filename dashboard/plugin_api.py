from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
from urllib import error, request

try:
    from fastapi import APIRouter, HTTPException
    from fastapi.responses import HTMLResponse
except ModuleNotFoundError:  # pragma: no cover - test fallback when FastAPI is unavailable
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class APIRouter:  # minimal decorator-compatible fallback for unit tests
        def get(self, _path: str):
            def decorator(fn):
                return fn
            return decorator

        def post(self, _path: str):
            def decorator(fn):
                return fn
            return decorator

    class HTMLResponse:
        media_type = 'text/html'

        def __init__(self, content: str, status_code: int = 200):
            self.content = content
            self.status_code = status_code
            self.body = content.encode('utf-8')

PLUGIN_ID = 'agent-analytics'
PLUGIN_STATE_FILE = 'agent-analytics-hermes-plugin.json'
DEFAULT_BASE_URL = 'https://api.agentanalytics.sh'
DEFAULT_SCOPES = ['account:read', 'projects:read', 'analytics:read']

router = APIRouter()


def default_state_path() -> Path:
    hermes_home = Path(os.environ.get('HERMES_HOME') or (Path.home() / '.hermes'))
    return hermes_home / 'state' / PLUGIN_STATE_FILE


def _empty_state() -> Dict[str, Any]:
    return {
        'auth': {
            'status': 'signed_out',
            'connected': False,
            'accountSummary': None,
            'tier': None,
            'accessToken': None,
            'refreshToken': None,
            'accessExpiresAt': None,
            'refreshExpiresAt': None,
            'pendingAuthRequest': None,
            'lastError': None,
        },
        'selectedProject': None,
    }


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


class AgentAnalyticsBackend:
    def __init__(self, *, state_path: Optional[Path] = None, base_url: str = DEFAULT_BASE_URL):
        self.state_path = state_path or default_state_path()
        self.base_url = base_url.rstrip('/')

    def load_state(self) -> Dict[str, Any]:
        if not self.state_path.exists():
            return _empty_state()
        data = json.loads(self.state_path.read_text())
        state = _empty_state()
        state.update(data)
        state['auth'].update(data.get('auth') or {})
        return state

    def save_state(self, state: Dict[str, Any]) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(state, indent=2, sort_keys=True))

    def _request_json(self, method: str, path: str, *, body: Optional[Dict[str, Any]] = None, access_token: Optional[str] = None, retry_on_refresh: bool = True) -> Dict[str, Any]:
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'AgentAnalyticsHermesPlugin/0.1 (+https://github.com/Agent-Analytics/agent-analytics-hermes-plugin)',
        }
        if access_token:
            headers['Authorization'] = f'Bearer {access_token}'
        req = request.Request(
            f'{self.base_url}{path}',
            method=method,
            headers=headers,
            data=json.dumps(body).encode('utf-8') if body is not None else None,
        )
        try:
            with request.urlopen(req, timeout=30) as response:
                return json.loads(response.read().decode('utf-8'))
        except error.HTTPError as exc:
            payload = {}
            try:
                payload = json.loads(exc.read().decode('utf-8'))
            except Exception:
                payload = {}
            raise RuntimeError(payload.get('message') or payload.get('error') or f'HTTP {exc.code}')

    def _normalize_status(self, state: Dict[str, Any], projects: Optional[list] = None) -> Dict[str, Any]:
        auth = state['auth']
        return {
            'auth': {
                'status': auth.get('status') or 'signed_out',
                'connected': bool(auth.get('accessToken')),
                'accountSummary': auth.get('accountSummary'),
                'tier': auth.get('tier'),
                'pendingAuthRequest': auth.get('pendingAuthRequest'),
                'lastError': auth.get('lastError'),
            },
            'selectedProject': state.get('selectedProject'),
            'projects': projects or [],
        }

    def _list_projects(self, state: Dict[str, Any]) -> list:
        if not state['auth'].get('accessToken'):
            return []
        data = self._request_json('GET', '/projects', access_token=state['auth']['accessToken'])
        return data.get('projects') or []

    def get_status(self) -> Dict[str, Any]:
        state = self.load_state()
        projects = []
        if state['auth'].get('accessToken'):
            try:
                projects = self._list_projects(state)
            except RuntimeError as exc:
                last_error = str(exc)
                state['auth'] = _empty_state()['auth']
                state['auth']['lastError'] = last_error
                self.save_state(state)
        return self._normalize_status(state, projects)

    def start_auth(self, dashboard_origin: str) -> Dict[str, Any]:
        state = self.load_state()
        code_verifier = os.urandom(16).hex()
        callback_url = f"{dashboard_origin.rstrip('/')}/api/plugins/{PLUGIN_ID}/auth/callback"
        started = self._request_json('POST', '/agent-sessions/start', body={
            'mode': 'interactive',
            'callback_url': callback_url,
            'code_challenge': _sha256_hex(code_verifier),
            'client_type': 'hermes_dashboard',
            'client_name': 'Agent Analytics Hermes Plugin',
            'client_instance_id': PLUGIN_ID,
            'scopes': DEFAULT_SCOPES,
            'metadata': {
                'platform': 'hermes',
                'plugin_id': PLUGIN_ID,
                'requires_existing_account': True,
                'setup_help_url': 'https://docs.agentanalytics.sh/installation/hermes/',
            },
        }, retry_on_refresh=False)
        state['auth'].update({
            'status': 'pending',
            'connected': False,
            'accessToken': None,
            'refreshToken': None,
            'accessExpiresAt': None,
            'refreshExpiresAt': None,
            'accountSummary': None,
            'tier': None,
            'lastError': None,
            'pendingAuthRequest': {
                'authRequestId': started['auth_request_id'],
                'authorizeUrl': started['authorize_url'],
                'pollToken': started['poll_token'],
                'expiresAt': started.get('expires_at'),
                'codeVerifier': code_verifier,
            },
        })
        self.save_state(state)
        return self._normalize_status(state)

    def poll_auth(self) -> Dict[str, Any]:
        state = self.load_state()
        pending = state['auth'].get('pendingAuthRequest')
        if not pending:
            if state['auth'].get('accessToken'):
                return self._normalize_status(state, self._list_projects(state))
            raise RuntimeError('No pending auth request')
        polled = self._request_json('POST', '/agent-sessions/poll', body={
            'auth_request_id': pending['authRequestId'],
            'poll_token': pending['pollToken'],
        }, retry_on_refresh=False)
        if polled.get('status') == 'pending':
            return self._normalize_status(state)
        if polled.get('status') not in {'approved', 'exchanged'}:
            state['auth']['lastError'] = f"Auth request {polled.get('status', 'failed')}"
            self.save_state(state)
            return self._normalize_status(state)
        self._exchange_into_state(state, pending['authRequestId'], polled['exchange_code'], pending.get('codeVerifier'))
        self.save_state(state)
        return self._normalize_status(state, self._list_projects(state))

    def _exchange_into_state(self, state: Dict[str, Any], auth_request_id: str, exchange_code: str, code_verifier: Optional[str]) -> Dict[str, Any]:
        exchanged = self._request_json('POST', '/agent-sessions/exchange', body={
            'auth_request_id': auth_request_id,
            'exchange_code': exchange_code,
            'code_verifier': code_verifier,
        }, retry_on_refresh=False)
        session = exchanged['agent_session']
        account = exchanged.get('account') or {}
        state['auth'].update({
            'status': 'connected',
            'connected': True,
            'accessToken': session['access_token'],
            'refreshToken': session['refresh_token'],
            'accessExpiresAt': session.get('access_expires_at'),
            'refreshExpiresAt': session.get('refresh_expires_at'),
            'accountSummary': {
                'id': account.get('id'),
                'email': account.get('email'),
            },
            'tier': account.get('tier'),
            'pendingAuthRequest': None,
            'lastError': None,
        })
        return {
            'status': 'connected',
            'account': state['auth']['accountSummary'],
        }

    def complete_auth_callback(self, request_id: str, exchange_code: str) -> Dict[str, Any]:
        state = self.load_state()
        pending = state['auth'].get('pendingAuthRequest') or {}
        if pending.get('authRequestId') != request_id:
            raise RuntimeError('Unknown auth request')
        result = self._exchange_into_state(state, request_id, exchange_code, pending.get('codeVerifier'))
        self.save_state(state)
        return result

    def disconnect(self) -> Dict[str, Any]:
        state = self.load_state()
        state['auth'] = _empty_state()['auth']
        self.save_state(state)
        return self._normalize_status(state)

    def select_project(self, project_id: str) -> Dict[str, Any]:
        state = self.load_state()
        projects = self._list_projects(state)
        project = next((item for item in projects if str(item.get('id')) == str(project_id)), None)
        if not project:
            raise RuntimeError('Project not found')
        state['selectedProject'] = {
            'id': project.get('id'),
            'name': project.get('name'),
            'allowedOrigins': project.get('allowed_origins'),
        }
        self.save_state(state)
        return self._normalize_status(state, projects)

    def get_summary(self, days: int = 7) -> Dict[str, Any]:
        state = self.load_state()
        token = state['auth'].get('accessToken')
        if not token:
            raise RuntimeError('Not connected')

        projects = self._list_projects(state)
        project_summaries = []
        for project_item in projects:
            project_id = project_item.get('id')
            project_name = project_item.get('name')
            if not project_id or not project_name:
                continue

            project = self._request_json('GET', f'/projects/{project_id}', access_token=token)
            usage = self._request_json('GET', f'/projects/{project_id}/usage?days={days}', access_token=token)
            stats = self._request_json('GET', f'/stats?project={project_name}&days={days}', access_token=token)
            pages = self._request_json('GET', f'/pages?project={project_name}&type=entry&days={days}&limit=10', access_token=token)
            events = self._request_json('GET', f'/events?project={project_name}&days={days}&limit=10', access_token=token)
            insights = self._request_json('GET', f'/insights?project={project_name}&period={days}d', access_token=token)

            project_summaries.append({
                'selectedProject': {
                    'id': project_id,
                    'name': project_name,
                    'allowedOrigins': project_item.get('allowed_origins'),
                },
                'project': project,
                'usage': usage,
                'stats': stats,
                'pages': pages,
                'events': events,
                'insights': insights,
            })

        return {
            'days': days,
            'projects': project_summaries,
        }


backend = AgentAnalyticsBackend()


@router.get('/status')
async def get_status() -> Dict[str, Any]:
    return backend.get_status()


@router.post('/auth/start')
async def start_auth(body: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return backend.start_auth(str(body.get('dashboard_origin') or ''))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post('/auth/poll')
async def poll_auth() -> Dict[str, Any]:
    try:
        return backend.poll_auth()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get('/auth/callback')
async def auth_callback(request_id: str, exchange_code: str) -> HTMLResponse:
    try:
        backend.complete_auth_callback(request_id, exchange_code)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return HTMLResponse("""<!doctype html><html><head><meta charset='utf-8'><title>Agent Analytics Connected</title><style>body{font-family:system-ui,sans-serif;background:#f3efe4;color:#101313;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#fff;padding:24px 28px;border-radius:18px;border:1px solid #d9d3c5;max-width:420px}h1{margin:0 0 8px;font-size:24px}p{margin:0 0 12px;color:#505757}button{border:1px solid #101313;background:#101313;color:#f7f2e6;border-radius:999px;padding:10px 16px;cursor:pointer}</style></head><body><div class='card'><h1>Login complete</h1><p>You can return to Hermes now. This window can close automatically.</p><button onclick='window.close()'>Close window</button></div><script>window.close();</script></body></html>""")


@router.post('/auth/disconnect')
async def disconnect() -> Dict[str, Any]:
    return backend.disconnect()


@router.post('/project/select')
async def select_project(body: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return backend.select_project(str(body.get('project_id') or ''))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get('/summary')
async def summary(days: int = 7) -> Dict[str, Any]:
    try:
        return backend.get_summary(days=days)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
