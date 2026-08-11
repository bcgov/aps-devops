package lab_min_citz_sys0.authz

import rego.v1

# Default deny everything
default allow := false

# Allow GET requests
allow if {
    input.method == "GET"
}