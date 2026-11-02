import asyncio
import importlib.util
import io
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

MODULE_PATH = pathlib.Path(__file__).resolve().parents[2] / 'dashboard' / 'plugin_api.py'
spec = importlib.util.spec_from_file_location('plugin_api', MODULE_PATH)
plugin_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin_api)


class FakeBackend(plugin_api.AgentAnalyticsBackend):
    def __init__(self, *, responses, state_path):
        super().__init__(state_path=state_path)
        self._responses = list(responses)
        self.calls = []

    def _request_json(self, method, path, *, body=None, access_token=None, retry_on_refresh=True):
        self.calls.append({
            'method': method,
            'path': path,
            'body': body,
            'access_token': access_token,
            'retry_on_refresh': retry_on_refresh,
        })
        if not self._responses:
            raise AssertionError('No fake responses left')
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


class AgentAnalyticsBackendTests(unittest.TestCase):
    def test_default_state_path_uses_hermes_home(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.environ['HERMES_HOME'] = tmp
            path = plugin_api.default_state_path()
            self.assertEqual(path, pathlib.Path(tmp) / 'state' / 'agent-analytics-hermes-plugin.json')

    def test_start_auth_persists_poll_only_pending_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            backend = FakeBackend(
                state_path=state_path,
                responses=[{
                    'auth_request_id': 'req_123',
                    'authorize_url': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_123',
                    'poll_token': 'aap_123',
                    'expires_at': 123456789,
                    'completion_mode': 'poll',
                }],
            )

            status = backend.start_auth()

            self.assertEqual(status['auth']['status'], 'pending')
            self.assertEqual(status['auth']['pendingAuthRequest']['authRequestId'], 'req_123')
            self.assertEqual(status['auth']['pendingAuthRequest']['completionMode'], 'poll')
            self.assertEqual(backend.calls[0]['path'], '/agent-sessions/start')
            self.assertEqual(backend.calls[0]['body']['mode'], 'interactive')
            self.assertEqual(backend.calls[0]['body']['client_type'], 'hermes_dashboard')
            self.assertNotIn('callback_url', backend.calls[0]['body'])
            self.assertEqual(
                backend.calls[0]['body']['metadata']['setup_help_url'],
                'https://docs.agentanalytics.sh/installation/hermes/'
            )
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['pendingAuthRequest']['pollToken'], 'aap_123')
            self.assertEqual(saved['auth']['pendingAuthRequest']['completionMode'], 'poll')
            self.assertTrue(saved['auth']['pendingAuthRequest']['codeVerifier'])
            self.assertEqual(
                backend.calls[0]['body']['code_challenge'],
                plugin_api._sha256_hex(saved['auth']['pendingAuthRequest']['codeVerifier'])
            )

    def test_poll_auth_keeps_pending_request_while_waiting_for_approval(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'pending',
                    'pendingAuthRequest': {
                        'authRequestId': 'req_pending',
                        'pollToken': 'aap_pending',
                        'authorizeUrl': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_pending',
                        'expiresAt': 123456789,
                        'completionMode': 'poll',
                        'codeVerifier': 'verifier_pending',
                    },
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[{'status': 'pending'}],
            )

            status = backend.poll_auth()

            self.assertEqual(status['auth']['status'], 'pending')
            self.assertEqual(status['auth']['pendingAuthRequest']['authRequestId'], 'req_pending')
            self.assertEqual(status['auth']['pendingAuthRequest']['completionMode'], 'poll')
            self.assertEqual(len(backend.calls), 1)
            self.assertEqual(backend.calls[0]['path'], '/agent-sessions/poll')
            self.assertEqual(backend.calls[0]['body'], {
                'auth_request_id': 'req_pending',
                'poll_token': 'aap_pending',
            })
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['pendingAuthRequest']['authRequestId'], 'req_pending')
            self.assertEqual(saved['auth']['pendingAuthRequest']['completionMode'], 'poll')

    def test_poll_auth_exchanges_and_marks_connected(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'pending',
                    'pendingAuthRequest': {
                        'authRequestId': 'req_123',
                        'pollToken': 'aap_123',
                        'authorizeUrl': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_123',
                        'expiresAt': 123456789,
                        'completionMode': 'poll',
                        'codeVerifier': 'verifier_123',
                    },
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {
                        'status': 'approved',
                        'exchange_code': 'aae_123',
                        'approved_email': 'ops@example.com',
                    },
                    {
                        'agent_session': {
                            'id': 'aas_session_1',
                            'access_token': 'aas_token_1',
                            'refresh_token': 'aar_token_1',
                            'access_expires_at': 111,
                            'refresh_expires_at': 222,
                            'scopes': ['account:read', 'projects:read', 'analytics:read'],
                        },
                        'account': {
                            'id': 'acct_1',
                            'email': 'ops@example.com',
                            'tier': 'pro',
                        },
                    },
                    {
                        'projects': [
                            {'id': 'proj_1', 'name': 'docs', 'allowed_origins': ['https://docs.agentanalytics.sh']}
                        ]
                    }
                ],
            )

            status = backend.poll_auth()

            self.assertTrue(status['auth']['connected'])
            self.assertEqual(status['auth']['accountSummary']['email'], 'ops@example.com')
            self.assertEqual(status['projects'][0]['name'], 'docs')
            self.assertEqual(backend.calls[0]['path'], '/agent-sessions/poll')
            self.assertEqual(backend.calls[1]['path'], '/agent-sessions/exchange')
            self.assertEqual(backend.calls[1]['body']['exchange_code'], 'aae_123')
            self.assertEqual(backend.calls[1]['body']['code_verifier'], 'verifier_123')
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['accessToken'], 'aas_token_1')
            self.assertIsNone(saved['auth']['pendingAuthRequest'])

    def test_poll_auth_exchanges_when_poll_status_is_exchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'pending',
                    'pendingAuthRequest': {
                        'authRequestId': 'req_exchanged',
                        'pollToken': 'aap_exchanged',
                        'authorizeUrl': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_exchanged',
                        'expiresAt': 123456789,
                        'completionMode': 'poll',
                        'codeVerifier': 'verifier_exchanged',
                    },
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {
                        'status': 'exchanged',
                        'exchange_code': 'aae_exchanged',
                    },
                    {
                        'agent_session': {
                            'id': 'aas_session_exchanged',
                            'access_token': 'aas_token_exchanged',
                            'refresh_token': 'aar_token_exchanged',
                        },
                        'account': {
                            'id': 'acct_exchanged',
                            'email': 'ops@example.com',
                            'tier': 'pro',
                        },
                    },
                    {'projects': []},
                ],
            )

            status = backend.poll_auth()

            self.assertTrue(status['auth']['connected'])
            self.assertEqual(backend.calls[1]['path'], '/agent-sessions/exchange')
            self.assertEqual(backend.calls[1]['body'], {
                'auth_request_id': 'req_exchanged',
                'exchange_code': 'aae_exchanged',
                'code_verifier': 'verifier_exchanged',
            })

    def test_legacy_auth_callback_exchanges_pending_cleanup_login(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'pending',
                    'pendingAuthRequest': {
                        'authRequestId': 'req_999',
                        'pollToken': 'aap_999',
                        'authorizeUrl': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_999',
                        'expiresAt': 123456789,
                        'codeVerifier': 'verifier_xyz',
                    },
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {
                        'agent_session': {
                            'id': 'aas_session_2',
                            'access_token': 'aas_token_2',
                            'refresh_token': 'aar_token_2',
                            'access_expires_at': 333,
                            'refresh_expires_at': 444,
                            'scopes': ['account:read', 'projects:read', 'analytics:read'],
                        },
                        'account': {
                            'id': 'acct_2',
                            'email': 'owner@example.com',
                            'tier': 'free',
                        },
                    }
                ],
            )

            result = backend.complete_auth_callback('req_999', 'aae_cb_1')

            self.assertEqual(result['status'], 'connected')
            self.assertEqual(result['account']['email'], 'owner@example.com')
            self.assertEqual(backend.calls[0]['path'], '/agent-sessions/exchange')
            self.assertEqual(backend.calls[0]['body']['code_verifier'], 'verifier_xyz')
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['status'], 'connected')
            self.assertEqual(saved['auth']['accountSummary']['email'], 'owner@example.com')
            self.assertIsNone(saved['auth']['pendingAuthRequest'])

    def test_poll_auth_returns_connected_status_after_callback_already_completed(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'connected',
                    'accessToken': 'aas_token_done',
                    'refreshToken': 'aar_token_done',
                    'accountSummary': {'email': 'owner@example.com'},
                    'tier': 'pro',
                    'pendingAuthRequest': None,
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {
                        'projects': [
                            {'id': 'proj_1', 'name': 'docs', 'allowed_origins': ['https://docs.agentanalytics.sh']}
                        ]
                    }
                ],
            )

            status = backend.poll_auth()

            self.assertTrue(status['auth']['connected'])
            self.assertEqual(status['auth']['status'], 'connected')
            self.assertEqual(status['projects'][0]['name'], 'docs')
            self.assertEqual(backend.calls[0]['path'], '/projects')

    def test_get_summary_returns_all_projects_side_by_side(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'connected',
                    'accessToken': 'aas_token_multi',
                    'pendingAuthRequest': None,
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {
                        'projects': [
                            {'id': 'proj_1', 'name': 'docs', 'allowed_origins': ['https://docs.agentanalytics.sh']},
                            {'id': 'proj_2', 'name': 'site', 'allowed_origins': ['https://agentanalytics.sh']},
                        ]
                    },
                    {'project': {'id': 'proj_1', 'name': 'docs'}, 'usage_today': {'event_count': 10, 'read_count': 1}},
                    {'rows': []},
                    {'totals': {'unique_users': 10, 'total_events': 20}, 'events': []},
                    {'rows': []},
                    {'events': []},
                    {'insights': []},
                    {'project': {'id': 'proj_2', 'name': 'site'}, 'usage_today': {'event_count': 30, 'read_count': 2}},
                    {'rows': []},
                    {'totals': {'unique_users': 30, 'total_events': 40}, 'events': []},
                    {'rows': []},
                    {'events': []},
                    {'insights': []},
                ],
            )

            summary = backend.get_summary(days=7)

            self.assertEqual(summary['days'], 7)
            self.assertEqual(len(summary['projects']), 2)
            self.assertEqual(summary['projects'][0]['selectedProject']['name'], 'docs')
            self.assertEqual(summary['projects'][1]['selectedProject']['name'], 'site')
            self.assertEqual(backend.calls[0]['path'], '/projects')
            self.assertIn('/projects/proj_1', backend.calls[1]['path'])
            self.assertIn('/projects/proj_2', backend.calls[7]['path'])

    def test_get_summary_keeps_free_sections_when_paid_sections_are_gated(self):
        UpstreamError = plugin_api.AgentAnalyticsAPIError

        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {'status': 'connected', 'accessToken': 'aas_token_free'},
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[
                    {'projects': [{'id': 'proj_free', 'name': 'trackersync', 'allowed_origins': []}]},
                    {'project': {'id': 'proj_free', 'name': 'trackersync'}},
                    {'usage_today': {'event_count': 8, 'read_count': 2}},
                    {'totals': {'unique_users': 4, 'total_events': 12}, 'events': []},
                    UpstreamError(403, 'PRO_REQUIRED', 'Pages require a paid plan'),
                    {'events': [{'event': 'page_view', 'count': 12}]},
                    UpstreamError(403, 'PRO_REQUIRED', 'Insights require a paid plan'),
                ],
            )

            summary = backend.get_summary(days=7)

            project_summary = summary['projects'][0]
            self.assertEqual(project_summary['project']['project']['name'], 'trackersync')
            self.assertEqual(project_summary['usage']['usage_today']['event_count'], 8)
            self.assertEqual(project_summary['stats']['totals']['total_events'], 12)
            self.assertEqual(project_summary['events']['events'][0]['event'], 'page_view')
            self.assertIsNone(project_summary['pages'])
            self.assertIsNone(project_summary['insights'])
            self.assertEqual(project_summary['unavailableSections'], {
                'pages': {'status': 403, 'code': 'PRO_REQUIRED'},
                'insights': {'status': 403, 'code': 'PRO_REQUIRED'},
            })
            self.assertEqual([call['path'].split('?')[0] for call in backend.calls[1:]], [
                '/projects/proj_free',
                '/projects/proj_free/usage',
                '/stats',
                '/pages',
                '/events',
                '/insights',
            ])

    def test_get_summary_propagates_authentication_and_server_errors(self):
        for status_code, error_code in (
            (401, 'AUTH_REQUIRED'),
            (400, 'PRO_REQUIRED'),
            (403, 'FORBIDDEN'),
            (500, 'INTERNAL_ERROR'),
        ):
            with self.subTest(status_code=status_code), tempfile.TemporaryDirectory() as tmp:
                state_path = pathlib.Path(tmp) / 'state.json'
                state_path.write_text(json.dumps({
                    'auth': {'status': 'connected', 'accessToken': 'aas_token_error'},
                    'selectedProject': None,
                }))
                upstream_error = plugin_api.AgentAnalyticsAPIError(
                    status_code, error_code, 'Upstream request failed'
                )
                backend = FakeBackend(
                    state_path=state_path,
                    responses=[
                        {'projects': [{'id': 'proj_1', 'name': 'docs'}]},
                        {'project': {'id': 'proj_1', 'name': 'docs'}},
                        {'usage_today': {'event_count': 1, 'read_count': 1}},
                        {'totals': {'unique_users': 1, 'total_events': 1}},
                        upstream_error,
                    ],
                )

                with self.assertRaises(plugin_api.AgentAnalyticsAPIError) as raised:
                    backend.get_summary(days=7)

                self.assertIs(raised.exception, upstream_error)
                self.assertEqual(raised.exception.status_code, status_code)
                self.assertEqual(raised.exception.error_code, error_code)

    def test_request_json_preserves_upstream_http_status_and_error_code(self):
        body = json.dumps({
            'error': 'PRO_REQUIRED',
            'message': 'This endpoint is available on paid plans.',
        }).encode('utf-8')
        upstream = plugin_api.error.HTTPError(
            'https://api.agentanalytics.sh/pages', 403, 'Forbidden', None, io.BytesIO(body)
        )
        backend = plugin_api.AgentAnalyticsBackend(state_path=pathlib.Path('/tmp/unused-state.json'))

        with patch.object(plugin_api.request, 'urlopen', side_effect=upstream):
            with self.assertRaises(plugin_api.AgentAnalyticsAPIError) as raised:
                backend._request_json('GET', '/pages', access_token='aas_test')

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.error_code, 'PRO_REQUIRED')
        self.assertEqual(str(raised.exception), 'This endpoint is available on paid plans.')

    def test_summary_route_preserves_upstream_http_status_and_error_code(self):
        class StubBackend:
            def get_summary(self, days):
                raise plugin_api.AgentAnalyticsAPIError(401, 'AUTH_REQUIRED', 'Authentication required')

        with patch.object(plugin_api, 'backend', StubBackend()):
            with self.assertRaises(plugin_api.HTTPException) as raised:
                asyncio.run(plugin_api.summary(days=7))

        self.assertEqual(raised.exception.status_code, 401)
        self.assertEqual(raised.exception.detail, {
            'error': 'AUTH_REQUIRED',
            'message': 'Authentication required',
        })

    def test_get_status_recovers_when_project_list_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'connected',
                    'accessToken': 'aas_bad_token',
                    'refreshToken': 'aar_bad_token',
                    'accountSummary': {'email': 'owner@example.com'},
                    'pendingAuthRequest': None,
                },
                'selectedProject': None,
            }))
            backend = FakeBackend(
                state_path=state_path,
                responses=[RuntimeError('Unauthorized')],
            )

            status = backend.get_status()

            self.assertFalse(status['auth']['connected'])
            self.assertEqual(status['auth']['status'], 'signed_out')
            self.assertEqual(status['auth']['lastError'], 'Unauthorized')
            saved = json.loads(state_path.read_text())
            self.assertIsNone(saved['auth']['accessToken'])
            self.assertEqual(saved['auth']['status'], 'signed_out')

    def test_legacy_auth_callback_returns_html_response(self):
        class StubBackend:
            def __init__(self):
                self.calls = []

            def complete_auth_callback(self, request_id, exchange_code):
                self.calls.append((request_id, exchange_code))
                return {'status': 'connected'}

        original_backend = plugin_api.backend
        stub_backend = StubBackend()
        plugin_api.backend = stub_backend
        try:
            response = asyncio.run(plugin_api.auth_callback('req_html', 'aae_html'))
        finally:
            plugin_api.backend = original_backend

        self.assertEqual(stub_backend.calls, [('req_html', 'aae_html')])
        self.assertEqual(getattr(response, 'media_type', None), 'text/html')
        body = response.body.decode('utf-8') if isinstance(response.body, (bytes, bytearray)) else str(response.body)
        self.assertIn('<!doctype html>', body)
        self.assertIn('window.close();', body)

    def test_legacy_auth_callback_runtime_errors_render_html_instead_of_json_detail(self):
        class StubBackend:
            def complete_auth_callback(self, request_id, exchange_code):
                raise RuntimeError('Unauthorized')

        original_backend = plugin_api.backend
        plugin_api.backend = StubBackend()
        try:
            response = asyncio.run(plugin_api.auth_callback('req_bad', 'aae_bad'))
        finally:
            plugin_api.backend = original_backend

        self.assertEqual(getattr(response, 'media_type', None), 'text/html')
        self.assertEqual(response.status_code, 400)
        body = response.body.decode('utf-8') if isinstance(response.body, (bytes, bytearray)) else str(response.body)
        self.assertIn('Login could not be completed', body)
        self.assertIn('Return to Hermes and start login again', body)
        self.assertNotIn('{"detail"', body)


if __name__ == '__main__':
    unittest.main()
