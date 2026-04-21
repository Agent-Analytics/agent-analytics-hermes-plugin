import asyncio
import importlib.util
import json
import os
import pathlib
import tempfile
import unittest

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

    def test_start_auth_persists_pending_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            backend = FakeBackend(
                state_path=state_path,
                responses=[{
                    'auth_request_id': 'req_123',
                    'authorize_url': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_123',
                    'approval_code': 'ABCD1234',
                    'poll_token': 'aap_123',
                    'expires_at': 123456789,
                }],
            )

            status = backend.start_auth('http://127.0.0.1:9119')

            self.assertEqual(status['auth']['status'], 'pending')
            self.assertEqual(status['auth']['pendingAuthRequest']['authRequestId'], 'req_123')
            self.assertEqual(backend.calls[0]['path'], '/agent-sessions/start')
            self.assertEqual(backend.calls[0]['body']['mode'], 'interactive')
            self.assertEqual(
                backend.calls[0]['body']['callback_url'],
                'http://127.0.0.1:9119/api/plugins/agent-analytics/auth/callback'
            )
            self.assertTrue(backend.calls[0]['body']['code_challenge'])
            self.assertEqual(
                backend.calls[0]['body']['metadata']['setup_help_url'],
                'https://docs.agentanalytics.sh/installation/hermes/'
            )
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['pendingAuthRequest']['pollToken'], 'aap_123')
            self.assertTrue(saved['auth']['pendingAuthRequest']['codeVerifier'])

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
                        'approvalCode': 'ABCD1234',
                        'expiresAt': 123456789,
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
            self.assertEqual(backend.calls[1]['body']['code_verifier'], 'verifier_123')
            saved = json.loads(state_path.read_text())
            self.assertEqual(saved['auth']['accessToken'], 'aas_token_1')
            self.assertIsNone(saved['auth']['pendingAuthRequest'])

    def test_complete_auth_callback_exchanges_interactive_login(self):
        with tempfile.TemporaryDirectory() as tmp:
            state_path = pathlib.Path(tmp) / 'state.json'
            state_path.write_text(json.dumps({
                'auth': {
                    'status': 'pending',
                    'pendingAuthRequest': {
                        'authRequestId': 'req_999',
                        'pollToken': 'aap_999',
                        'authorizeUrl': 'https://api.agentanalytics.sh/agent-sessions/authorize/req_999',
                        'approvalCode': 'WXYZ9876',
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

    def test_auth_callback_returns_html_response(self):
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


if __name__ == '__main__':
    unittest.main()
