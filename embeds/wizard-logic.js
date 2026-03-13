/**
 * Murdock Trust Grant Finder — Wizard Logic
 * Webflow Custom Code Embed (before </body>)
 *
 * Dependencies:
 *   - Finsweet CMS Filter (loaded via Webflow page settings <head>):
 *     <script defer src="https://cdn.jsdelivr.net/npm/@finsweet/attributes-cmsfilter@1/cmsfilter.js"></script>
 *
 * This script handles:
 *   1. Wizard step navigation with progress bar
 *   2. Org type conditional logic (church sub-question, disqualification)
 *   3. Subsector population from CMS data attributes
 *   4. Grant type disabled states per subsector
 *   5. Eligibility banner rendering (Zone A)
 *   6. Grant type detail rendering (Zone B)
 *   7. Card/list view toggle with expand/collapse
 *   8. Sticky summary bar
 *   9. Print support
 *
 * Finsweet CMS Filter handles:
 *   - Guideline card filtering by sector, subsectors, grant-types (Zone C)
 *   - Result count
 *   - Empty state
 */

const MurdockWizard = (() => {
  'use strict';

  const TOTAL_STEPS = 5;

  // ── Subsector data (mirrors CMS but needed for wizard step 4 rendering) ──
  const SUBSECTORS = {
    'artistic-cultural': [
      { value: 'arts-education', label: 'Arts Education', desc: 'Community-based, outside school hours' },
      { value: 'exhibits', label: 'Exhibits', desc: 'Permanent, traveling, curatorial' },
      { value: 'museums-heritage', label: 'Museums & Heritage', desc: 'Historical societies, heritage orgs' },
      { value: 'historic-preservation', label: 'Historic Preservation', desc: 'With ongoing outreach' },
      { value: 'literary-arts', label: 'Literary Arts', desc: 'Not individual writers' },
      { value: 'media-broadcasting', label: 'Media & Broadcasting', desc: 'Equipment/tech only' },
      { value: 'performing-arts', label: 'Performing Arts', desc: 'Not production seasons' },
    ],
    'civic-engagement': [
      { value: 'housing-security', label: 'Housing Security', desc: 'Shelter, transitional, supportive' },
      { value: 'food-security', label: 'Food Security', desc: 'Upstream systems or wraparound' },
      { value: 'youth-clubs-camps', label: 'Youth Clubs & Camps', desc: 'Currently paused', status: 'paused' },
      { value: 'enterprise', label: 'Enterprise (Micro/Small)', desc: 'Services to entrepreneurs' },
      { value: 'community-development', label: 'Community Development', desc: 'Asset-based connections' },
      { value: 'wraparound-services', label: 'Wraparound Services', desc: 'Refugees, foster care, reentry' },
      { value: 'strengthening-democracy', label: 'Strengthening Democracy', desc: 'Civic ed, bridge-building' },
      { value: 'faith-formation', label: 'Faith Formation', desc: 'Human flourishing, common good' },
    ],
    'education-leadership': [
      { value: 'early-childhood', label: 'Early Childhood', desc: 'Currently paused (2 years)', status: 'paused' },
      { value: 'secondary-schools', label: 'Secondary Schools', desc: 'Middle & high school' },
      { value: 'community-colleges', label: 'Community Colleges', desc: 'Vocational, trade, technical' },
      { value: 'four-year-institutions', label: 'Four-Year Institutions', desc: 'Higher education' },
      { value: 'community-foundations', label: 'Community Foundations', desc: 'Not scholarship requests' },
      { value: 'leadership-development', label: 'Leadership Development', desc: 'Capacity-building cohorts' },
      { value: 'generosity-philanthropy', label: 'Generosity & Philanthropy', desc: 'By invitation only', status: 'invite-only' },
    ],
    'health-environmental': [
      { value: 'hospitals', label: 'Hospitals', desc: 'Under 100 beds only' },
      { value: 'community-health-centers', label: 'Health Centers & Clinics', desc: 'FQHCs, rural, free clinics' },
      { value: 'community-health-orgs', label: 'Community Health Orgs', desc: 'Public health, wellness' },
      { value: 'mental-health', label: 'Mental Health', desc: 'Youth mental health only' },
      { value: 'abuse-prevention', label: 'Abuse Prevention & Healing', desc: 'DV, child abuse, trafficking' },
      { value: 'disabilities-support', label: 'Disabilities Support', desc: 'All grant types eligible' },
      { value: 'equine-therapy', label: 'Equine Therapy', desc: 'Accreditation required' },
      { value: 'natural-resource-wildlife', label: 'Natural Resource & Wildlife', desc: 'Regional stewardship' },
      { value: 'land-trusts', label: 'Land Trusts', desc: 'Accredited, regional reach' },
      { value: 'outdoor-engagement', label: 'Outdoor Engagement', desc: 'Youth programming only' },
    ],
    'scientific-research': [
      { value: 'research-instrumentation', label: 'Research Instrumentation', desc: 'Annual grants for instruments' },
      { value: 'higher-ed-strategic', label: 'Higher Ed Strategic Projects', desc: 'Capital, equipment, programs' },
    ],
  };

  // Grant types disabled per subsector
  const DISABLED_GRANTS = {
    'media-broadcasting': ['staff-program', 'capital'],
    'natural-resource-wildlife': ['capital'],
    'land-trusts': ['capital'],
    'outdoor-engagement': ['capital'],
    'hospitals': ['staff-program'],
    'community-health-centers': ['staff-program'],
    'research-instrumentation': ['staff-program', 'capital'],
  };

  // Labels
  const SECTOR_LABELS = {
    'artistic-cultural': 'Artistic & Cultural Expression',
    'civic-engagement': 'Civic Engagement & Community',
    'education-leadership': 'Education & Leadership',
    'health-environmental': 'Health & Environmental',
    'scientific-research': 'Scientific Research',
  };
  const STATE_LABELS = { alaska: 'Alaska', idaho: 'Idaho', montana: 'Montana', oregon: 'Oregon', washington: 'Washington' };
  const ORG_LABELS = { '501c3': '501(c)(3) Nonprofit', tribal: 'Tribal Entity', government: 'Government Entity', church: 'Church / Faith-Based' };
  const GRANT_LABELS = { 'staff-program': 'Staff/Program Expansion', capital: 'Capital Project', 'equipment-tech': 'Equipment & Technology' };

  // ── DOM References ──
  const $ = (id) => document.getElementById(id);
  const banner = $('js-banner');
  const grantDetail = $('js-grant-detail');
  const guideGrid = $('js-guideline-grid');
  const emptyState = $('js-empty-state');
  const allSteps = document.querySelectorAll('.wizard_step');
  const circles = document.querySelectorAll('.wizard_progress-circle');
  const progSteps = document.querySelectorAll('.wizard_progress-step');
  const lines = document.querySelectorAll('.wizard_progress-line-fill');
  const disqualifyEl = $('js-disqualify');
  const churchQ = $('js-church-question');
  const orgNav = $('js-org-nav');
  const stickyBar = $('js-sticky-summary');
  const stickyTags = $('js-sticky-tags');
  const controls = $('js-controls');
  const expandBtn = $('js-expand-all');

  let currentStep = 1;
  let isDisqualified = false;
  let currentView = sessionStorage.getItem('murdock-view') || 'cards';
  let allExpanded = false;

  // ── Render Static Steps (1-3) ──
  // Steps 1-3 option buttons are generated here instead of static HTML
  // so they work inside Webflow's CMS-driven page structure.
  function buildOption(name, value, label, sub, iconSvg) {
    return '<label class="wizard_option"><input type="radio" name="' + name + '" value="' + value + '">' +
      '<span class="wizard_option-card">' +
      (iconSvg ? '<span class="wizard_option-icon">' + iconSvg + '</span>' : '') +
      '<span class="wizard_option-text">' + label + '</span>' +
      (sub ? '<span class="wizard_option-sub">' + sub + '</span>' : '') +
      '</span></label>';
  }

  function renderStaticSteps() {
    // Step 1: State selection
    var step1 = document.querySelector('[data-step="1"] .wizard_options');
    if (step1 && !step1.children.length) {
      var stateAbbr = { alaska: 'AK', idaho: 'ID', montana: 'MT', oregon: 'OR', washington: 'WA' };
      var html = '';
      Object.keys(STATE_LABELS).forEach(function(k) {
        html += buildOption('state', k, STATE_LABELS[k], stateAbbr[k], '');
      });
      step1.innerHTML = html;
    }

    // Step 2: Org type selection
    var step2 = document.querySelector('[data-step="2"] .wizard_options');
    if (step2 && !step2.children.length) {
      var orgIcons = {
        '501c3': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4" opacity=".5"/><path d="M9 10h1M14 10h1M9 14h1M14 14h1"/></svg>',
        tribal: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" opacity=".5"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
        government: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V10l8-6 8 6v11" opacity=".5"/><rect x="9" y="13" width="6" height="8"/><line x1="12" y1="7" x2="12" y2="10"/></svg>',
        church: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M8 6h8M6 22V10l6-4 6 4v12" opacity=".5"/><rect x="9" y="15" width="6" height="7"/></svg>',
        other: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".5"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>'
      };
      var orgSubs = { government: 'University, medical center', other: '' };
      var orgLabels = { '501c3': '501(c)(3) Nonprofit', tribal: 'Tribal Entity', government: 'Government Entity', church: 'Church / Faith-Based', other: 'Other / Not Sure' };
      var html2 = '';
      Object.keys(orgLabels).forEach(function(k) {
        html2 += buildOption('org-type', k, orgLabels[k], orgSubs[k] || '', orgIcons[k]);
      });
      step2.innerHTML = html2;
    }

    // Church sub-question content
    if (churchQ && !churchQ.children.length) {
      churchQ.innerHTML = '<p class="wizard_sub-question-text">Does your church or faith-based organization have a separate 501(c)(3) tax-exempt status?</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:1rem;">' +
        '<button type="button" class="btn-primary" onclick="MurdockWizard.churchAnswer(true)" style="padding:10px 24px;font-size:.875rem;">Yes, we have 501(c)(3) status</button>' +
        '<button type="button" class="btn-ghost" onclick="MurdockWizard.churchAnswer(false)">No, we do not</button>' +
        '</div>';
    }

    // Org nav (back button for step 2)
    if (orgNav && !orgNav.children.length) {
      orgNav.innerHTML = '<button type="button" class="btn-ghost" onclick="MurdockWizard.back(2)">&larr; Back</button>';
    }

    // Step 3: Sector selection
    var step3 = document.querySelector('[data-step="3"] .wizard_options');
    if (step3 && !step3.children.length) {
      var sectorIcons = {
        'artistic-cultural': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a9 9 0 019 9c0 3.9-3.1 7.1-7 9l-2 1-2-1c-3.9-1.9-7-5.1-7-9a9 9 0 019-9z" opacity=".5"/><circle cx="8" cy="9" r="1.5"/><circle cx="15" cy="8" r="1.5"/><circle cx="12" cy="13" r="1.5"/></svg>',
        'civic-engagement': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" opacity=".5"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
        'education-leadership': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" opacity=".5"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
        'health-environmental': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" opacity=".5"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
        'scientific-research': '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v7l-4 8h14l-4-8V3" opacity=".5"/><path d="M8 3h8M12 3v7"/></svg>'
      };
      var html3 = '';
      Object.keys(SECTOR_LABELS).forEach(function(k) {
        html3 += buildOption('sector', k, SECTOR_LABELS[k], '', sectorIcons[k]);
      });
      step3.innerHTML = html3;
      // Add back button for step 3
      var nav3 = document.querySelector('[data-step="3"] .wizard_nav');
      if (nav3 && !nav3.children.length) {
        nav3.innerHTML = '<button type="button" class="btn-ghost" onclick="MurdockWizard.back(3)">&larr; Back</button>';
      }
    }

    // Add back-button navs to steps 3-5 (injected as needed)
    [3, 4, 5].forEach(function(n) {
      var stepEl = document.querySelector('[data-step="' + n + '"]');
      if (!stepEl) return;
      var nav = stepEl.querySelector('.wizard_nav');
      if (!nav) {
        nav = document.createElement('div');
        nav.className = 'wizard_nav';
        stepEl.appendChild(nav);
      }
      if (!nav.querySelector('.btn-ghost')) {
        var back = document.createElement('button');
        back.type = 'button';
        back.className = 'btn-ghost';
        back.onclick = function() { MurdockWizard.back(n); };
        back.innerHTML = '&larr; Back';
        nav.insertBefore(back, nav.firstChild);
      }
      if (n === 5 && !stepEl.querySelector('.btn-primary')) {
        var cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'btn-primary is-cta';
        cta.onclick = function() { MurdockWizard.complete(); };
        cta.innerHTML = 'View My Guidelines &rarr;';
        nav.appendChild(cta);
      }
    });
  }

  // ── Utility ──
  function sel(name) {
    const el = document.querySelector('#eligibility-wizard input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  // ── Step Navigation ──
  function goToStep(step) {
    currentStep = step;
    isDisqualified = false;
    disqualifyEl.classList.remove('is-active');

    allSteps.forEach(el => el.classList.toggle('is-active', parseInt(el.dataset.step) === step));
    circles.forEach(c => {
      const p = parseInt(c.dataset.prog);
      c.classList.remove('is-active', 'is-complete');
      if (p === step) c.classList.add('is-active');
      if (p < step) c.classList.add('is-complete');
    });
    progSteps.forEach(s => {
      const p = parseInt(s.dataset.progStep);
      s.classList.remove('is-active', 'is-complete');
      if (p === step) s.classList.add('is-active');
      if (p < step) s.classList.add('is-complete');
    });
    lines.forEach(l => l.classList.toggle('is-filled', parseInt(l.dataset.line) < step));

    if (step === 4) populateSubsectors();
    if (step === 5) updateGrantTypeStates();
    churchQ.classList.remove('is-visible');
    orgNav.style.display = '';
  }

  function validate(stepNum) {
    const step = document.querySelector('[data-step="' + stepNum + '"]');
    if (!step) return false;
    const radios = step.querySelectorAll('input[type="radio"]');
    if (radios.length === 0) return true;
    const ok = Array.from(radios).some(r => r.checked);
    if (!ok) {
      const g = step.querySelector('.wizard_options');
      if (g) { g.style.animation = 'none'; void g.offsetHeight; g.style.animation = 'wizardShake 400ms ease'; }
    }
    return ok;
  }

  // ── Org Type Logic ──
  function handleOrgType() {
    const v = sel('org-type');
    churchQ.classList.remove('is-visible');
    orgNav.style.display = '';

    if (v === 'church') {
      churchQ.classList.add('is-visible');
      orgNav.style.display = 'none';
      return false;
    }
    if (v === 'other') {
      showDisqualify('Based on the information provided, your organization type may not be eligible for Murdock Trust funding through the standard application process. However, every situation is unique \u2014 we encourage you to reach out and discuss your specific circumstances.');
      return false;
    }
    return true;
  }

  function showDisqualify(msg) {
    isDisqualified = true;
    allSteps.forEach(el => el.classList.remove('is-active'));
    disqualifyEl.classList.add('is-active');
    $('js-disqualify-text').textContent = msg;
  }

  // ── Subsector Population (Step 4) ──
  function populateSubsectors() {
    const sector = sel('sector');
    const container = $('js-subsector-options');
    const title = $('js-subsector-title');
    const subs = SUBSECTORS[sector] || [];
    title.textContent = 'Which area within ' + (SECTOR_LABELS[sector] || sector) + '?';

    container.className = 'wizard_options' + (subs.length <= 3 ? ' is-3col' : ' is-3col');

    container.innerHTML = subs.map(s => {
      const statusClass = s.status === 'paused' ? ' is-paused' : s.status === 'invite-only' ? ' is-invite-only' : '';
      const statusText = s.status === 'paused' ? 'Paused' : s.status === 'invite-only' ? 'Invite Only' : s.desc;
      return '<label class="wizard_option' + statusClass + '">'
        + '<input type="radio" name="subsector" value="' + s.value + '">'
        + '<span class="wizard_option-card">'
        + '<span class="wizard_option-text">' + s.label + '</span>'
        + '<span class="wizard_option-sub">' + statusText + '</span>'
        + '</span></label>';
    }).join('');

    const prev = document.querySelector('input[name="subsector"]:checked');
    if (prev) prev.checked = false;
  }

  // ── Grant Type States (Step 5) ──
  function updateGrantTypeStates() {
    const subsector = sel('subsector');
    const disabled = DISABLED_GRANTS[subsector] || [];
    document.querySelectorAll('#js-grant-type-options .wizard_option').forEach(opt => {
      const gt = opt.dataset.grantType;
      const isDis = disabled.includes(gt);
      opt.classList.toggle('is-disabled', isDis);
      if (isDis) {
        const radio = opt.querySelector('input');
        if (radio && radio.checked) radio.checked = false;
      }
    });
  }

  // ── Zone A: Eligibility Banner ──
  function renderBanner() {
    const state = sel('state');
    const org = sel('org-type');
    const sector = sel('sector');
    const subsector = sel('subsector');
    const grantType = sel('grant-type');

    const subData = (SUBSECTORS[sector] || []).find(s => s.value === subsector);
    const isPaused = subData && subData.status === 'paused';
    const isInvite = subData && subData.status === 'invite-only';
    const isAmber = isPaused || isInvite;

    const cls = isAmber ? 'is-amber' : 'is-green';
    const icon = isAmber ? '&#9888;&#65039;' : '&#9989;';
    const statusText = isPaused ? 'This subsector is currently paused'
      : isInvite ? 'This subsector is by invitation only'
        : 'Your organization appears eligible';

    const parts = [
      '<strong>' + STATE_LABELS[state] + '</strong>',
      '<strong>' + (ORG_LABELS[org] || org) + '</strong>',
      '<strong>' + (SECTOR_LABELS[sector] || sector) + '</strong>',
      '<strong>' + (subData ? subData.label : subsector) + '</strong>',
      '<strong>' + (GRANT_LABELS[grantType] || grantType) + '</strong>',
    ];

    banner.className = 'eligibility-banner is-visible ' + cls;
    banner.innerHTML = '<span class="eligibility-banner_icon">' + icon + '</span>'
      + '<div class="eligibility-banner_text">'
      + '<div class="eligibility-banner_status">' + statusText + '</div>'
      + '<div class="eligibility-banner_summary">' + parts.join(' &middot; ') + '</div>'
      + '</div>'
      + '<button class="eligibility-banner_edit" onclick="MurdockWizard.reset()">Edit Selections</button>';
  }

  // ── Zone B: Grant Type Detail (reads from CMS item via data attributes) ──
  function renderGrantDetail() {
    const gt = sel('grant-type');
    // In Webflow, grant type details are CMS-bound elements with [data-grant-type] attributes.
    // Show the matching one, hide the rest.
    const allDetails = document.querySelectorAll('[data-grant-detail]');
    allDetails.forEach(el => {
      el.style.display = el.dataset.grantDetail === gt ? 'block' : 'none';
    });
    // Fallback: if using a single container approach
    if (grantDetail) {
      grantDetail.classList.toggle('is-visible', !!gt);
    }
  }

  // ── Finsweet CMS Filter Integration ──
  // Sets hidden input values that Finsweet reads to filter CMS collection list items
  function updateCmsFilters() {
    const sector = sel('sector');
    const subsector = sel('subsector');
    const grantType = sel('grant-type');

    // Finsweet CMS Filter reads from elements with [fs-cmsfilter-field] attributes.
    // We set hidden inputs that match the filter configuration.
    const sectorFilter = $('fs-filter-sector');
    const subsectorFilter = $('fs-filter-subsector');
    const grantTypeFilter = $('fs-filter-grant-type');

    if (sectorFilter) sectorFilter.value = sector || '';
    if (subsectorFilter) subsectorFilter.value = subsector || '';
    if (grantTypeFilter) grantTypeFilter.value = grantType || '';

    // Trigger Finsweet filter recalculation
    if (window.FsAttributes && window.FsAttributes.cmsfilter) {
      window.FsAttributes.cmsfilter.then((filterInstances) => {
        filterInstances.forEach(instance => instance.resetFilters());
      });
    }
  }

  // ── Sticky Summary Bar ──
  function renderStickyBar() {
    const state = sel('state');
    const org = sel('org-type');
    const sector = sel('sector');
    const subsector = sel('subsector');
    const grantType = sel('grant-type');
    const subData = (SUBSECTORS[sector] || []).find(s => s.value === subsector);

    const pills = [
      STATE_LABELS[state],
      ORG_LABELS[org] || org,
      SECTOR_LABELS[sector] || sector,
      subData ? subData.label : subsector,
      GRANT_LABELS[grantType] || grantType,
    ].filter(Boolean);

    stickyTags.innerHTML = pills.map((p, i) =>
      (i > 0 ? '<span class="sticky-summary_sep">&middot;</span>' : '')
      + '<span class="sticky-summary_tag">' + p + '</span>'
    ).join('');
    stickyBar.classList.add('is-visible');

    const meta = $('js-print-meta');
    if (meta) meta.textContent = pills.join(' \u00b7 ') + ' \u2014 ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function hideStickyBar() {
    stickyBar.classList.remove('is-visible', 'is-expanded');
    stickyTags.innerHTML = '';
  }

  // ── View Toggle ──
  function applyView(mode) {
    currentView = mode;
    sessionStorage.setItem('murdock-view', mode);
    guideGrid.classList.toggle('is-list-view', mode === 'list');
    $('js-view-cards').classList.toggle('is-active', mode === 'cards');
    $('js-view-list').classList.toggle('is-active', mode === 'list');
    expandBtn.classList.toggle('is-visible', mode === 'list');
    if (mode === 'list') addListStructure();
    if (mode === 'cards') {
      guideGrid.querySelectorAll('.guideline-card.is-expanded').forEach(c => c.classList.remove('is-expanded'));
      allExpanded = false;
      expandBtn.textContent = 'Expand All';
    }
  }

  function toggleExpandAll() {
    allExpanded = !allExpanded;
    guideGrid.querySelectorAll('.guideline-card').forEach(c => c.classList.toggle('is-expanded', allExpanded));
    expandBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
  }

  // ── List View Structure ──
  // Adds list-row elements to CMS-rendered guideline cards for list view display
  function addListStructure() {
    guideGrid.querySelectorAll('.guideline-card').forEach(card => {
      if (card.querySelector('.list-row')) return;
      const title = card.querySelector('.guideline-card_title');
      const summary = card.querySelector('.guideline-card_summary');
      const context = card.querySelector('.guideline-card_context');
      const top = card.querySelector('.guideline-card_top');

      const tagEl = top ? top.querySelector('.guideline-card_tag') : null;
      const statusEl = top ? top.querySelector('.guideline-card_status') : null;
      const badgesHTML = (tagEl ? tagEl.outerHTML : '') + (statusEl ? statusEl.outerHTML : '');

      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = '<span class="list-row_badges">' + badgesHTML + '</span>'
        + '<span class="list-row_title">' + (title ? title.textContent : '') + '</span>'
        + '<span class="list-row_summary">' + (summary ? summary.textContent : '') + '</span>'
        + '<svg class="list-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>';

      const expand = document.createElement('div');
      expand.className = 'list-expand';
      expand.innerHTML = (summary ? '<div class="list-expand_summary">' + summary.innerHTML + '</div>' : '')
        + (context ? '<div class="list-expand_context">' + context.innerHTML + '</div>' : '');

      card.appendChild(row);
      card.appendChild(expand);

      row.addEventListener('click', () => {
        card.classList.toggle('is-expanded');
        const total = guideGrid.querySelectorAll('.guideline-card').length;
        const expanded = guideGrid.querySelectorAll('.guideline-card.is-expanded').length;
        allExpanded = expanded === total;
        expandBtn.textContent = allExpanded ? 'Collapse All' : 'Expand All';
      });
    });
  }

  function scrollToDashboard() {
    const t = $('dashboard-section');
    const y = t.getBoundingClientRect().top + window.pageYOffset - 40;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // ── Card Reveal Animation (for CMS-rendered cards) ──
  function revealCards() {
    const cards = guideGrid.querySelectorAll('.guideline-card');
    cards.forEach((c, i) => setTimeout(() => c.classList.add('is-visible'), 50 * i));
  }

  // ── Initialize: render options and show step 1 on load ──
  renderStaticSteps();
  goToStep(1);
  controls.style.display = 'none';

  // ── Org Type Radio Listener (delegated — radios created dynamically) ──
  document.getElementById('eligibility-wizard').addEventListener('change', function (e) {
    if (e.target.type !== 'radio') return;

    // Handle org-type specific logic
    if (e.target.name === 'org-type') {
      var v = e.target.value;
      churchQ.classList.remove('is-visible');
      orgNav.style.display = '';
      if (v === 'church') {
        churchQ.classList.add('is-visible');
        orgNav.style.display = 'none';
        return; // Don't auto-advance — wait for church answer
      } else if (v === 'other') {
        showDisqualify('Based on the information provided, your organization type may not be eligible for Murdock Trust funding through the standard application process. However, every situation is unique \u2014 we encourage you to reach out and discuss your specific circumstances.');
        return; // Don't auto-advance — show disqualify
      }
    }

    // Auto-advance on radio selection (steps 1-4)
    var step = e.target.closest('.wizard_step');
    if (!step) return;
    var stepNum = parseInt(step.dataset.step);
    if (stepNum >= 5) return;
    setTimeout(function () { MurdockWizard.next(stepNum); }, 300);
  });

  // ── Public API ──
  return {
    next(from) {
      if (!validate(from)) return;
      if (from === 2 && !handleOrgType()) return;
      if (from < TOTAL_STEPS) goToStep(from + 1);
    },
    back(from) { if (from > 1) goToStep(from - 1); },
    complete() {
      if (!validate(5)) return;
      renderBanner();
      renderGrantDetail();
      updateCmsFilters();
      renderStickyBar();
      controls.style.display = '';
      // Wait for Finsweet to filter, then add list structure and reveal
      setTimeout(() => {
        addListStructure();
        applyView(currentView);
        revealCards();
      }, 300);
      setTimeout(scrollToDashboard, 400);
    },
    reset() {
      document.querySelectorAll('#eligibility-wizard input[type="radio"]').forEach(r => { r.checked = false; });
      banner.className = 'eligibility-banner';
      banner.innerHTML = '';
      if (grantDetail) {
        grantDetail.classList.remove('is-visible');
        grantDetail.innerHTML = '';
      }
      document.querySelectorAll('[data-grant-detail]').forEach(el => { el.style.display = 'none'; });
      guideGrid.classList.remove('is-list-view');
      if (emptyState) emptyState.classList.remove('is-visible');
      hideStickyBar();
      controls.style.display = 'none';
      // Reset Finsweet filters
      updateCmsFilters();
      goToStep(1);
      $('wizard-section').scrollIntoView({ behavior: 'smooth' });
    },
    toggleView(mode) { applyView(mode); },
    toggleExpandAll() { toggleExpandAll(); },
    printSummary() { window.print(); },
    churchAnswer(has503) {
      churchQ.classList.remove('is-visible');
      if (has503) {
        orgNav.style.display = '';
        goToStep(3);
      } else {
        showDisqualify('Churches and places of worship need a separate 501(c)(3) tax-exempt status to be eligible for Murdock Trust funding. If your organization has a community outreach arm with its own 501(c)(3) designation, that entity may be eligible.');
      }
    },
    backFromDisqualify() {
      isDisqualified = false;
      disqualifyEl.classList.remove('is-active');
      goToStep(2);
    },
  };
})();
