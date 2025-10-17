{{/* vim: set filetype=mustache: */}}
{{/*
Define the fullname of the service
*/}}
{{- define "sdx-edge.fullname" -}}
{{- printf "%s-%s" "sdx-edge" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
