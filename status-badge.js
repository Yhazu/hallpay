/* /assets/js/components/status-badge.js */
function renderStatusBadge(status){return`<span class="badge ${statusClasses[status]||'badge-draft'}">${statusLabels[status]||status}</span>`}
