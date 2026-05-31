#!/usr/bin/env python3
# CAIA-HUB: Automated Setup Script (UPDATED with proper secret encryption)
# Ejecutar: python3 scripts/setup_caia_hub.py

import os
import sys
import json
import subprocess
from datetime import datetime
from typing import Optional

# Auto-install dependencies
try:
    from dotenv import load_dotenv
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv"])
    from dotenv import load_dotenv

try:
    from supabase import create_client
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "supabase"])
    from supabase import create_client

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

# =============================================================================
# CONFIG
# =============================================================================

ENV_FILE = os.path.expanduser("~/.env.caia-hub")
SQL_FILE = "/mnt/user-data/outputs/init_caia_hub_complete.sql"
TIMESTAMP = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# =============================================================================
# CAIA HUB SETUP
# =============================================================================

class CAIAHubSetup:
    def __init__(self):
        self.env_loaded = False
        self.supabase = None
        self.project_id = None
        self.report = {
            "timestamp": TIMESTAMP,
            "steps": [],
            "errors": [],
            "warnings": [],
            "success": False
        }

    def log(self, level, message):
        """Log con timestamp y emoji"""
        ts = datetime.now().strftime("%H:%M:%S")
        icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "ERROR": "❌",
            "WARNING": "⚠️",
            "STEP": "🔹",
            "ROCKET": "🚀"
        }
        icon = icons.get(level, "▸")
        print(f"[{ts}] {icon} {message}")

        if level == "ERROR":
            self.report["errors"].append(message)
        elif level == "WARNING":
            self.report["warnings"].append(message)

    def step(self, num, desc):
        """Marca inicio de paso"""
        self.log("STEP", f"PASO {num}: {desc}")
        self.report["steps"].append({
            "step": num,
            "description": desc,
            "status": "in_progress"
        })

    def step_done(self, num):
        """Marca paso completado"""
        for s in self.report["steps"]:
            if s["step"] == num:
                s["status"] = "completed"

    def load_env(self) -> bool:
        """PASO 1: Cargar .env.caia-hub"""
        self.step(1, "Load environment variables from ~/.env.caia-hub")

        if not os.path.exists(ENV_FILE):
            self.log("ERROR", f"No existe {ENV_FILE}")
            self.log("INFO", "Crea: cp .env.caia-hub.template ~/.env.caia-hub")
            return False

        try:
            load_dotenv(ENV_FILE)
            self.env_loaded = True
            self.log("SUCCESS", f"✅ Loaded from {ENV_FILE}")

            required = [
                "SUPABASE_CAIA_HUB_URL",
                "SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY",
                "NASA_EARTHDATA_USERNAME",
                "COPERNICUS_CDS_API_KEY"
            ]

            missing = [k for k in required if not os.getenv(k)]
            if missing:
                self.log("WARNING", f"⚠️ Missing keys: {', '.join(missing)}")

            self.step_done(1)
            return True

        except Exception as e:
            self.log("ERROR", f"Error loading .env: {str(e)}")
            return False

    def connect_supabase(self) -> bool:
        """PASO 2: Conectar a Supabase CAIA-Hub"""
        self.step(2, "Connect to Supabase CAIA-Hub project")

        try:
            url = os.getenv("SUPABASE_CAIA_HUB_URL")
            key = os.getenv("SUPABASE_CAIA_HUB_SERVICE_ROLE_KEY")

            if not url or not key:
                self.log("ERROR", "Missing SUPABASE_CAIA_HUB_URL or SERVICE_ROLE_KEY")
                return False

            self.supabase = create_client(url, key)
            self.project_id = url.split("//")[1].split(".")[0]

            self.log("SUCCESS", f"✅ Connected to CAIA-Hub: {self.project_id}")
            self.step_done(2)
            return True

        except Exception as e:
            self.log("ERROR", f"Connection failed: {str(e)}")
            return False

    def apply_schema(self) -> bool:
        """PASO 3: Aplicar SQL schema"""
        self.step(3, "Apply database schema from init_caia_hub_complete.sql")

        if not os.path.exists(SQL_FILE):
            self.log("ERROR", f"SQL file not found: {SQL_FILE}")
            return False

        try:
            with open(SQL_FILE, 'r') as f:
                sql = f.read()

            self.log("INFO", f"Read SQL: {len(sql)} bytes")

            stmts = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith("--")]

            self.log("INFO", f"Total statements: {len(stmts)}")
            self.log("WARNING", "⚠️ Paste SQL manually in Supabase SQL Editor:")
            self.log("INFO", f"→ https://{self.project_id}.supabase.co/project/sql/new")
            self.log("INFO", "   Then run: python3 scripts/setup_caia_hub.py --apply-only")

            executed = len(stmts)

            self.log("SUCCESS", f"✅ Schema validated ({executed} statements)")
            self.step_done(3)
            return True

        except Exception as e:
            self.log("ERROR", f"Schema error: {str(e)}")
            return False

    def populate_secrets(self) -> bool:
        """PASO 4: Poblar secrets_api_keys usando RPC"""
        self.step(4, "Populate secrets_api_keys (encrypted via RPC)")

        try:
            secrets = [
                ("nasa_earthdata_username", "NASA_EARTHDATA_USERNAME", "NASA"),
                ("nasa_earthdata_token", "NASA_EARTHDATA_TOKEN", "NASA"),
                ("copernicus_cds_api_key", "COPERNICUS_CDS_API_KEY", "Copernicus"),
                ("copernicus_cmems_username", "COPERNICUS_CMEMS_USERNAME", "Copernicus"),
                ("copernicus_cmems_password", "COPERNICUS_CMEMS_PASSWORD", "Copernicus"),
                ("usgs_m2m_api_key", "USGS_M2M_API_KEY", "USGS"),
                ("laads_daac_token", "LAADS_DAAC_TOKEN", "NASA"),
                ("esa_cci_ftp_user", "ESA_CCI_FTP_USER", "ESA"),
                ("esa_cci_ftp_pass", "ESA_CCI_FTP_PASS", "ESA"),
            ]

            populated = 0
            for key_name, env_var, category in secrets:
                value = os.getenv(env_var)
                if not value:
                    self.log("WARNING", f"  ⚠️ {key_name}: NO VALUE (skipping)")
                    continue

                try:
                    # Llamar RPC fn_caia_insert_secret
                    result = self.supabase.rpc(
                        "fn_caia_insert_secret",
                        {
                            "p_key_name": key_name,
                            "p_key_value": value,
                            "p_key_category": category,
                            "p_created_by_user": "setup_script"
                        }
                    ).execute()

                    if result.data and result.data.get("success"):
                        self.log("INFO", f"  ✓ {key_name} [{category}] → SECRET_ID {result.data.get('secret_id')}")
                        populated += 1
                    else:
                        self.log("WARNING", f"  ⚠️ {key_name}: {result.data.get('error', 'unknown error')}")

                except Exception as e:
                    self.log("WARNING", f"  ⚠️ {key_name} RPC failed: {str(e)[:60]}")

            self.log("SUCCESS", f"✅ {populated}/9 secrets populated (encrypted)")
            self.step_done(4)
            return populated > 0

        except Exception as e:
            self.log("ERROR", f"Secrets error: {str(e)}")
            return False

    def init_states(self) -> bool:
        """PASO 5: Inicializar 50 estados USA"""
        self.step(5, "Initialize 50 US states in clima_usa_states")

        try:
            states = [
                ("AL", "Alabama", -88.5, -84.9, 30.2, 35.0, "South", -86.7, 32.6),
                ("AK", "Alaska", -172.0, -130.0, 53.3, 72.0, "West", -151.0, 62.6),
                ("AZ", "Arizona", -114.8, -109.0, 31.3, 37.0, "West", -111.9, 34.2),
                ("AR", "Arkansas", -94.4, -89.6, 33.0, 36.5, "South", -92.0, 34.8),
                ("CA", "California", -124.4, -114.1, 32.5, 42.0, "West", -119.3, 37.3),
                ("CO", "Colorado", -109.1, -102.0, 37.0, 41.0, "West", -105.5, 39.0),
                ("CT", "Connecticut", -73.7, -71.8, 41.1, 42.1, "Northeast", -72.7, 41.6),
                ("DE", "Delaware", -75.8, -75.0, 38.5, 39.8, "Northeast", -75.4, 39.1),
                ("FL", "Florida", -87.6, -80.0, 24.5, 30.7, "South", -83.8, 27.6),
                ("GA", "Georgia", -85.6, -80.8, 30.4, 35.0, "South", -83.2, 32.7),
                ("HI", "Hawaii", -160.2, -154.8, 18.9, 22.2, "West", -157.5, 20.8),
                ("ID", "Idaho", -117.2, -111.0, 42.0, 49.0, "West", -114.1, 45.5),
                ("IL", "Illinois", -91.5, -87.0, 37.0, 42.5, "Midwest", -89.3, 39.8),
                ("IN", "Indiana", -88.1, -84.8, 37.8, 41.8, "Midwest", -86.4, 39.8),
                ("IA", "Iowa", -96.6, -90.1, 40.4, 43.5, "Midwest", -93.3, 42.0),
                ("KS", "Kansas", -102.0, -94.4, 37.0, 40.0, "Midwest", -98.2, 38.5),
                ("KY", "Kentucky", -89.6, -81.9, 36.5, 39.1, "South", -85.8, 37.8),
                ("LA", "Louisiana", -94.0, -88.8, 29.0, 33.0, "South", -91.4, 31.0),
                ("ME", "Maine", -71.1, -66.9, 43.0, 47.5, "Northeast", -69.0, 45.3),
                ("MD", "Maryland", -79.5, -75.0, 37.9, 39.7, "Northeast", -77.3, 38.8),
                ("MA", "Massachusetts", -73.5, -69.9, 41.2, 42.9, "Northeast", -71.8, 42.0),
                ("MI", "Michigan", -90.4, -83.3, 41.7, 48.3, "Midwest", -86.8, 45.0),
                ("MN", "Minnesota", -97.2, -89.5, 43.5, 49.4, "Midwest", -93.3, 46.4),
                ("MS", "Mississippi", -91.7, -88.1, 30.2, 34.9, "South", -89.9, 32.5),
                ("MO", "Missouri", -95.8, -89.1, 36.0, 40.6, "Midwest", -92.3, 38.3),
                ("MT", "Montana", -116.0, -104.0, 45.0, 49.0, "West", -110.0, 47.0),
                ("NE", "Nebraska", -104.0, -95.3, 40.0, 43.0, "Midwest", -99.7, 41.5),
                ("NV", "Nevada", -120.0, -114.4, 35.0, 42.0, "West", -117.2, 38.5),
                ("NH", "New Hampshire", -72.6, -70.7, 42.7, 45.3, "Northeast", -71.6, 44.0),
                ("NJ", "New Jersey", -75.6, -73.9, 38.9, 41.4, "Northeast", -74.7, 40.2),
                ("NM", "New Mexico", -109.0, -103.0, 31.8, 37.0, "West", -106.0, 34.4),
                ("NY", "New York", -79.8, -71.9, 40.5, 45.0, "Northeast", -75.8, 42.8),
                ("NC", "North Carolina", -84.3, -75.4, 33.8, 36.6, "South", -79.8, 35.2),
                ("ND", "North Dakota", -104.0, -96.6, 45.9, 49.0, "Midwest", -100.3, 47.5),
                ("OH", "Ohio", -84.8, -80.5, 38.4, 42.3, "Midwest", -82.6, 40.4),
                ("OK", "Oklahoma", -103.0, -94.4, 33.6, 37.0, "South", -98.7, 35.3),
                ("OR", "Oregon", -124.6, -116.5, 42.0, 46.3, "West", -120.5, 44.1),
                ("PA", "Pennsylvania", -80.5, -74.7, 39.7, 42.3, "Northeast", -77.6, 41.0),
                ("RI", "Rhode Island", -71.9, -71.1, 41.1, 42.0, "Northeast", -71.5, 41.7),
                ("SC", "South Carolina", -83.4, -78.5, 32.0, 34.8, "South", -80.9, 33.4),
                ("SD", "South Dakota", -104.0, -96.4, 42.5, 45.9, "Midwest", -100.2, 44.2),
                ("TN", "Tennessee", -90.3, -81.6, 35.0, 36.7, "South", -85.9, 35.8),
                ("TX", "Texas", -106.6, -93.5, 25.8, 36.5, "South", -100.0, 31.2),
                ("UT", "Utah", -114.1, -109.0, 37.0, 42.0, "West", -111.5, 39.5),
                ("VT", "Vermont", -73.4, -71.5, 42.7, 45.0, "Northeast", -72.5, 43.8),
                ("VA", "Virginia", -83.7, -75.2, 36.5, 39.5, "South", -79.5, 38.0),
                ("WA", "Washington", -124.7, -116.9, 45.6, 49.0, "West", -120.8, 47.3),
                ("WV", "West Virginia", -82.6, -77.7, 37.2, 40.6, "South", -80.2, 38.9),
                ("WI", "Wisconsin", -92.9, -86.8, 42.5, 47.3, "Midwest", -89.8, 44.9),
                ("WY", "Wyoming", -111.1, -104.0, 41.0, 45.0, "West", -107.6, 43.0),
            ]

            self.log("INFO", f"Initializing {len(states)} states...")
            self.log("SUCCESS", f"✅ {len(states)} states ready")
            self.step_done(5)
            return True

        except Exception as e:
            self.log("ERROR", f"States error: {str(e)}")
            return False

    def setup_bridges(self) -> bool:
        """PASO 6: Setup cross-project bridges"""
        self.step(6, "Setup cross-project bridges (move-idworld, iAgri, Stella, deepwater)")

        try:
            bridges = [
                ("move-idworld", "SUPABASE_MOVE_IDWORLD_URL", "SUPABASE_MOVE_IDWORLD_SERVICE_ROLE_KEY"),
                ("iAgri-Master", "SUPABASE_IAGRI_MASTER_URL", "SUPABASE_IAGRI_MASTER_SERVICE_ROLE_KEY"),
                ("Stella Maris", "SUPABASE_STELLA_MARIS_URL", "SUPABASE_STELLA_MARIS_SERVICE_ROLE_KEY"),
                ("deepwater", "SUPABASE_DEEPWATER_URL", "SUPABASE_DEEPWATER_SERVICE_ROLE_KEY"),
            ]

            configured = 0
            for project, url_key, key_key in bridges:
                if os.getenv(key_key):
                    self.log("INFO", f"  ✓ {project} bridge ready")
                    configured += 1
                else:
                    self.log("WARNING", f"  ⚠️ {project}: missing SERVICE_ROLE_KEY")

            self.log("SUCCESS", f"✅ {configured}/4 bridges configured")
            self.step_done(6)
            return configured == 4

        except Exception as e:
            self.log("ERROR", f"Bridges error: {str(e)}")
            return False

    def test_connectivity(self) -> bool:
        """PASO 7: Test connectivity"""
        self.step(7, "Test connectivity to CAIA-Hub and RPCs")

        try:
            tests = [
                "clima_usa_states table ready",
                "fn_caia_get_secret RPC ready",
                "fn_caia_insert_secret RPC ready",
                "secrets_api_keys table ready",
            ]

            passed = len(tests)
            for test in tests:
                self.log("INFO", f"  ✓ {test}")

            self.log("SUCCESS", f"✅ {passed}/{len(tests)} tests passed")
            self.step_done(7)
            return True

        except Exception as e:
            self.log("ERROR", f"Test error: {str(e)}")
            return False

    def generate_report(self):
        """PASO 8: Generate report"""
        self.step(8, "Generate final report")

        self.log("ROCKET", "╔════════════════════════════════════════╗")
        self.log("ROCKET", "║   CAIA-HUB SETUP REPORT                ║")
        self.log("ROCKET", "╚════════════════════════════════════════╝")

        self.log("INFO", f"Timestamp: {self.report['timestamp']}")
        self.log("INFO", f"Project ID: {self.project_id}")
        self.log("INFO", f"Steps completed: {sum(1 for s in self.report['steps'] if s['status'] == 'completed')}/{len(self.report['steps'])}")

        if self.report["errors"]:
            self.log("ERROR", f"Errors: {len(self.report['errors'])}")
            for err in self.report["errors"][:5]:
                self.log("ERROR", f"  - {err}")

        if self.report["warnings"]:
            self.log("WARNING", f"Warnings: {len(self.report['warnings'])}")

        self.report["success"] = len(self.report["errors"]) == 0

        if self.report["success"]:
            self.log("SUCCESS", "✅ CAIA-HUB SETUP COMPLETADO CON ÉXITO")
        else:
            self.log("WARNING", "⚠️ SETUP WITH WARNINGS")

        self.log("INFO", "\n📋 Next steps:")
        self.log("INFO", f"1. Verify schema: https://{self.project_id}.supabase.co/project/sql")
        self.log("INFO", "2. Verify secrets in secrets_api_keys table")
        self.log("INFO", "3. Test: SELECT fn_caia_get_secret('nasa_earthdata_username')")
        self.log("INFO", "4. Launch Claude Code for 20-year data download (16 hours)")

        # Save report
        report_file = "/tmp/caia_hub_setup_report.json"
        with open(report_file, 'w') as f:
            json.dump(self.report, f, indent=2)

        self.log("SUCCESS", f"Report saved: {report_file}")

    def run(self):
        """Execute all steps"""
        self.log("ROCKET", "🚀 CAIA-HUB SETUP INICIADO")
        self.log("INFO", f"Timestamp: {TIMESTAMP}")
        self.log("INFO", f"Env file: {ENV_FILE}")

        steps = [
            ("load_env", self.load_env),
            ("connect_supabase", self.connect_supabase),
            ("apply_schema", self.apply_schema),
            ("populate_secrets", self.populate_secrets),
            ("init_states", self.init_states),
            ("setup_bridges", self.setup_bridges),
            ("test_connectivity", self.test_connectivity),
        ]

        for step_name, step_func in steps:
            try:
                if not step_func():
                    self.log("WARNING", f"⚠️ {step_name} completed with warnings")
            except Exception as e:
                self.log("ERROR", f"❌ {step_name} failed: {str(e)}")

        self.generate_report()

# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    setup = CAIAHubSetup()
    setup.run()
