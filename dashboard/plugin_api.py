from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional
from urllib import error, request

try:
    from fastapi import APIRouter, HTTPException
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
        projects = self._list_projects(state) if state['auth'].get('accessToken') else []
        return self._normalize_status(state, projects)

    def start_auth(self) -> Dict[str, Any]:
        state = self.load_state()
        started = self._request_json('POST', '/agent-sessions/start', body={
            'mode': 'detached',
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
                'approvalCode': started.get('approval_code'),
                'pollToken': started['poll_token'],
                'expiresAt': started.get('expires_at'),
            },
        })
        self.save_state(state)
        return self._normalize_status(state)

    def poll_auth(self) -> Dict[str, Any]:
        state = self.load_state()
        pending = state['auth'].get('pendingAuthRequest')
        if not pending:
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
        exchanged = self._request_json('POST', '/agent-sessions/exchange', body={
            'auth_request_id': pending['authRequestId'],
            'exchange_code': polled['exchange_code'],
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
        self.save_state(state)
        return self._normalize_status(state, self._list_projects(state))

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
        selected = state.get('selectedProject')
        if not selected or not selected.get('name'):
            raise RuntimeError('No project selected')
        token = state['auth'].get('accessToken')
        if not token:
            raise RuntimeError('Not connected')
        project_id = selected.get('id')
        project_name = selected.get('name')
        project = self._request_json('GET', f'/projects/{project_id}', access_token=token)
        usage = self._request_json('GET', f'/projects/{project_id}/usage?days={days}', access_token=token)
        stats = self._request_json('GET', f'/stats?project={project_name}&days={days}', access_token=token)
        pages = self._request_json('GET', f'/pages?project={project_name}&type=entry&days={days}&limit=10', access_token=token)
        events = self._request_json('GET', f'/events?project={project_name}&days={days}&limit=10', access_token=token)
        insights = self._request_json('GET', f'/insights?project={project_name}&period={days}d', access_token=token)
        return {
            'project': project,
            'usage': usage,
            'stats': stats,
            'pages': pages,
            'events': events,
            'insights': insights,
        }


backend = AgentAnalyticsBackend()


@router.get('/status')
async def get_status() -> Dict[str, Any]:
    return backend.get_status()


@router.post('/auth/start')
async def start_auth() -> Dict[str, Any]:
    try:
        return backend.start_auth()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post('/auth/poll')
async def poll_auth() -> Dict[str, Any]:
    try:
        return backend.poll_auth()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
