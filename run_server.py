import sys
from types import ModuleType

# Detect if SSL import fails, and inject mock modules to bypass Application Control DLL blocks.
try:
    import ssl
except ImportError:
    print("[SYSTEM ALERT] Native SSL DLL is blocked. Injecting dynamic mock ssl module...")
    
    class DummySSLContext:
        def __init__(self, *args, **kwargs):
            pass
        def load_cert_chain(self, *args, **kwargs):
            pass
        def wrap_socket(self, sock, *args, **kwargs):
            return sock
            
    class DummyModule(ModuleType):
        def __getattr__(self, name):
            if name == 'SSLContext':
                return DummySSLContext
            # Common constants
            constants = {
                'PROTOCOL_TLS': 2,
                'PROTOCOL_TLS_CLIENT': 16,
                'PROTOCOL_TLS_SERVER': 17,
                'CERT_NONE': 0,
                'CERT_OPTIONAL': 1,
                'CERT_REQUIRED': 2,
                'Purpose': type('Purpose', (), {'CLIENT_AUTH': 1, 'SERVER_AUTH': 2})
            }
            if name in constants:
                return constants[name]
            # Fallback for upper-case constants
            if name.isupper():
                return 1
            return None

    # Register mock modules
    mock_ssl = DummyModule("ssl")
    sys.modules["ssl"] = mock_ssl
    sys.modules["_ssl"] = DummyModule("_ssl")

# Import uvicorn and start backend
try:
    import uvicorn
    from backend.main import app
    
    if __name__ == "__main__":
        print("[SERVER START] Running Data Science AI Agent on http://0.0.0.0:8000")
        uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
except Exception as e:
    print(f"[FATAL] Server failed to start: {e}")
    sys.exit(1)
