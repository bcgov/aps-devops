import type { Organization } from "../../types.ts";
import { Btn } from "../Btn.tsx";

interface OrgPickerProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  /** Form GET target — the route this picker reloads. */
  action: string;
  /** Submit button label (also the no-JS fallback). */
  submitLabel: string;
  /** Submit automatically when the selection changes. */
  autoSubmit?: boolean;
}

// Shared across every Member Console org selector. Handles:
//  - "Pin organization" → persists the choice in localStorage and uses it as the
//    default selection on any console page opened without an explicit ?org=.
//  - optional submit-on-change.
// The pin is keyed globally so a pinned org carries across all console pages.
const ORG_PICKER_SCRIPT = `
(function(){
  var KEY = 'sdx.console.pinnedOrg';
  var form = document.getElementById('org-picker-form');
  if(!form) return;
  var sel = form.querySelector('select[name="org"]');
  var pinBtn = document.getElementById('org-pin-btn');
  var autoSubmit = form.getAttribute('data-autosubmit') === '1';

  function getPinned(){ try { return localStorage.getItem(KEY) || ''; } catch(_) { return ''; } }
  function setPinned(v){ try { if(v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch(_){} }
  function hasOption(v){ for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value === v) return true; } return false; }

  function applyPinned(isPinned){
    if(!pinBtn) return;
    pinBtn.classList.toggle('border-bc-blue', isPinned);
    pinBtn.classList.toggle('text-bc-blue', isPinned);
    pinBtn.classList.toggle('bg-surface-blue-tint', isPinned);
    pinBtn.classList.toggle('border-border-dark', !isPinned);
    pinBtn.classList.toggle('text-ink', !isPinned);
    var lbl = pinBtn.querySelector('[data-pin-label]');
    if(lbl) lbl.textContent = isPinned ? 'Pinned' : 'Pin organization';
    var ic = pinBtn.querySelector('svg');
    if(ic) ic.setAttribute('fill', isPinned ? 'currentColor' : 'none');
    pinBtn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
  }
  function renderPin(){
    if(!pinBtn) return;
    var cur = sel.value;
    if(!cur){
      pinBtn.disabled = true; applyPinned(false);
      pinBtn.title = 'Select an organization to pin it as your default';
      return;
    }
    pinBtn.disabled = false;
    var isPinned = getPinned() === cur;
    applyPinned(isPinned);
    pinBtn.title = isPinned
      ? 'Unpin — stop using this as your default organization'
      : 'Pin this organization as your default across the Member Console';
  }

  if(pinBtn){
    pinBtn.addEventListener('click', function(){
      var cur = sel.value; if(!cur) return;
      setPinned(getPinned() === cur ? '' : cur);
      renderPin();
    });
  }
  sel.addEventListener('change', function(){
    renderPin();
    if(autoSubmit && this.form) this.form.submit();
  });

  renderPin();

  // Default to the pinned organization when opened without an explicit selection.
  var params = new URLSearchParams(window.location.search);
  if(!params.has('org')){
    var pinned = getPinned();
    if(pinned && pinned !== sel.value && hasOption(pinned)){
      sel.value = pinned;
      renderPin();
      form.submit();
    }
  }
})();
`;

export function OrgPicker({
  organizations,
  selectedOrg,
  action,
  submitLabel,
  autoSubmit,
}: OrgPickerProps) {
  const sorted = organizations
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <>
      <form
        id="org-picker-form"
        method="get"
        action={action}
        data-autosubmit={autoSubmit ? "1" : undefined}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor="org-select" className="text-sm font-medium text-ink-secondary">
          Organization member
        </label>
        <select
          id="org-select"
          name="org"
          defaultValue={selectedOrg?.name ?? ""}
          className="border border-border rounded px-3 py-2 text-sm min-w-[260px] bg-white text-ink focus:border-border-active"
        >
          <option value="">— Select an organization —</option>
          {sorted.map((o) => (
            <option key={o.name} value={o.name}>
              {o.title} ({o.member.memberClass}/{o.member.memberId})
            </option>
          ))}
        </select>
        <Btn type="submit">{submitLabel}</Btn>
        <button
          type="button"
          id="org-pin-btn"
          disabled
          aria-pressed="false"
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded border border-border-dark text-ink hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
          </svg>
          <span data-pin-label>Pin organization</span>
        </button>
      </form>
      <script dangerouslySetInnerHTML={{ __html: ORG_PICKER_SCRIPT }} />
    </>
  );
}
