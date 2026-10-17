{{/* vim: set filetype=mustache: */}}
{{/*
Define the fullname of the service
*/}}
{{- define "sdx-edge.fullname" -}}
{{- printf "%s-%s" "sdx-edge" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "sdx-edge.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sdx-edge.labels" -}}
helm.sh/chart: {{ include "sdx-edge.chart" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{/* Release packages use the same immutable image for init and proxy. */}}
{{- define "sdx-edge.image" -}}
{{- if .Values.kong.imageDigest -}}
ghcr.io/bcgov/aps-devops/sdx-access-point@{{ .Values.kong.imageDigest }}
{{- else -}}
ghcr.io/bcgov/aps-devops/sdx-access-point:{{ .Chart.AppVersion }}
{{- end -}}
{{- end -}}
