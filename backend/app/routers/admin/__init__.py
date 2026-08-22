"""Admin platform routers (Admin Dashboard V2; spec §2.1).

AD1a establishes the package with the shared ``require_admin`` dependency
(``deps.py``); existing admin endpoints keep their paths and adopt the
dependency in place. Endpoint modules (users, statics, audit, metrics,
search, ops) land here slice-by-slice as their frontends are rebuilt.
"""
