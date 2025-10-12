# Selector Reference Guide

## How to Find and Update Selectors

When a scraper isn't finding jobs, you need to update the selectors. Here's how:

### Step-by-Step Process:

1. **Open the platform website** in your browser
2. **Right-click on a job listing** → Inspect (or press F12)
3. **Find the HTML element** that contains the job
4. **Right-click the element** → Copy → Copy selector
5. **Paste into Actions tab** in the app
6. **Save and test**

---

## Platform-Specific Selector Examples

### 1. Himalayas (himalayas.app)

**Current Selectors:**
```json
{
  "jobCardSelector": "a[href*='/jobs/']",
  "companySelector": ".company-name, [data-company], .text-dark-aaaa",
  "titleSelector": ".job-title, h3, .font-medium"
}
```

**How to Find:**
```
1. Go to: https://himalayas.app/jobs
2. Right-click any job card
3. Inspect → Look for:
   - Job link: Usually <a href="/jobs/xxx">
   - Company: Look for company name text
   - Title: Look for job title text
```

**Alternative Selectors to Try:**
```json
{
  "jobCardSelector": "article a, .job-card a, [data-job]",
  "companySelector": ".company, [data-company-name], h4",
  "titleSelector": "h2, h3, .title, .job-title"
}
```

---

### 2. RemoteOK (remoteok.com)

**Current Selectors:**
```json
{
  "jobRowSelector": "tr.job",
  "companySelector": "h3",
  "titleSelector": "h2",
  "linkSelector": "a.preventLink"
}
```

**Structure:**
- Jobs are in table rows: `<tr class="job">`
- Each row has company in `<h3>`
- Job title in `<h2>`
- Link has class `preventLink`

**Alternative Selectors:**
```json
{
  "jobRowSelector": "table tr[data-id], .job-row",
  "companySelector": ".company, h3, [itemprop='hiringOrganization']",
  "titleSelector": ".position, h2, [itemprop='title']",
  "linkSelector": "a[href*='/remote-jobs/']"
}
```

---

### 3. We Work Remotely (weworkremotely.com)

**Current Selectors:**
```json
{
  "jobSelector": "li.feature a, section.jobs article a",
  "companySelector": ".company",
  "titleSelector": ".title"
}
```

**Structure:**
- Jobs in `<li class="feature">` elements
- Company and title have specific classes

**Alternative Selectors:**
```json
{
  "jobSelector": "article a, .job-listing a, li a[href*='/remote-jobs/']",
  "companySelector": ".company-name, [data-company], span.company",
  "titleSelector": ".job-title, .position, span.title"
}
```

---

### 4. Jobgether (jobgether.com)

**Current Selectors:**
```json
{
  "jobCardSelector": "[data-testid='job-card'], .job-card, a[href*='/offer/']",
  "companySelector": ".company-name, [data-testid='company']",
  "titleSelector": ".job-title, h3, h2"
}
```

**Common Issues:**
- May use React/Vue (dynamic class names)
- Look for `data-testid` attributes
- Check for `data-*` attributes

**Alternative Selectors:**
```json
{
  "jobCardSelector": "[role='article'] a, .offer-card, div[data-offer]",
  "companySelector": "[data-company], .employer, p:first-child",
  "titleSelector": "[data-title], .position, h2, h3"
}
```

---

### 5. BuiltIn (builtin.com)

**Current Selectors:**
```json
{
  "jobCardSelector": "a[data-id*='job'], .job-item a, [data-job-id]",
  "companySelector": ".company-title, [data-company-name]",
  "titleSelector": ".job-title, h2, h3"
}
```

**Structure:**
- Jobs may have `data-id` attributes
- Company info in specific divs

**Alternative Selectors:**
```json
{
  "jobCardSelector": "article a, .job-card a, [href*='/job/']",
  "companySelector": ".company, .employer-name, h4",
  "titleSelector": ".title, .position, h3"
}
```

---

### 6. ZipRecruiter (ziprecruiter.com)

**Current Selectors:**
```json
{
  "jobCardSelector": "a[data-job-id], .job_link, article a",
  "companySelector": ".hiring_company, [itemprop='hiringOrganization']",
  "titleSelector": ".job_title, h2[itemprop='title']"
}
```

**Notes:**
- May have bot detection
- Uses Schema.org markup (`itemprop`)
- Multiple possible structures

**Alternative Selectors:**
```json
{
  "jobCardSelector": "[data-job-id], .job-card-list a, .job_result a",
  "companySelector": ".company, .name, [data-company]",
  "titleSelector": ".job-title, h2, [data-title]"
}
```

---

### 7. Jobright (jobright.ai)

**Current Selectors:**
```json
{
  "jobCardSelector": "[data-testid='job-card'], .job-listing, a[href*='/job/']",
  "companySelector": ".company, [data-company]",
  "titleSelector": ".title, h3, h2"
}
```

**Notes:**
- AI-powered site, may have dynamic content
- Look for data attributes
- May load jobs via JavaScript

**Alternative Selectors:**
```json
{
  "jobCardSelector": "[role='link'], .opportunity-card, div[data-job]",
  "companySelector": "[data-employer], .employer, span.company",
  "titleSelector": "[data-position], .job-name, h2"
}
```

---

## Generic Selector Patterns

### Common Job Card Patterns:
```css
article
.job-card
.job-listing
[data-testid="job"]
[data-job-id]
a[href*="/job/"]
a[href*="/jobs/"]
li.job
tr.job
```

### Common Company Patterns:
```css
.company
.company-name
.employer
h3
h4
[data-company]
[data-testid="company"]
[itemprop="hiringOrganization"]
```

### Common Title Patterns:
```css
.title
.job-title
.position
h2
h3
[data-title]
[data-testid="title"]
[itemprop="title"]
```

---

## Testing Selectors in Browser Console

Open browser console (F12) on the job platform and test:

```javascript
// Test job card selector
document.querySelectorAll('YOUR_SELECTOR').length
// Should return number of jobs found

// Test specific job
document.querySelector('YOUR_SELECTOR')
// Should return one element

// Test company/title
document.querySelector('YOUR_SELECTOR')?.textContent
// Should return text content
```

**Example:**
```javascript
// On remoteok.com
document.querySelectorAll('tr.job').length  // Returns: 20
document.querySelector('tr.job h3').textContent  // Returns: "Company Name"
document.querySelector('tr.job h2').textContent  // Returns: "Job Title"
```

---

## Updating Through UI

1. Open Job Searcher app
2. Go to **Actions** tab
3. Select platform from dropdown
4. Click **Load Actions** (shows current selectors)
5. Modify JSON with new selectors
6. Click **Save Actions**
7. Go to Jobs tab
8. Click **Stop Scraping** then **Start Scraping**
9. Check console for results

---

## Updating Through Code

Edit file: `src/main/scrapers/platforms/PLATFORM_NAME.js`

Find this section:
```javascript
if (!actions) {
  actions = {
    jobCardSelector: 'YOUR_SELECTOR',
    companySelector: 'YOUR_SELECTOR',
    titleSelector: 'YOUR_SELECTOR'
  };
}
```

Replace with your new selectors, save file, restart app.

---

## Advanced Selector Techniques

### Multiple Selectors (Fallback)
```json
{
  "companySelector": ".company-name, .company, h3, [data-company]"
}
```
The scraper will try each selector until one works.

### Attribute Selectors
```json
{
  "jobCardSelector": "a[href*='/jobs/']"
}
```
Matches links where href contains `/jobs/`

### Data Attributes
```json
{
  "jobCardSelector": "[data-testid='job-card']"
}
```
Targets elements with specific data attributes.

### Child Selectors
```json
{
  "companySelector": ".job-card > .company"
}
```
Direct child only.

### Descendant Selectors
```json
{
  "titleSelector": ".job-card .title"
}
```
Any descendant.

---

## Troubleshooting

### Issue: Selector returns 0 results
**Solution:** Website structure changed or selector is too specific

**Try:**
1. Simplify selector (use just class name)
2. Check if element exists in browser inspector
3. Look for alternative elements

### Issue: Selector returns wrong text
**Solution:** Selector is targeting wrong element

**Try:**
1. Be more specific (add parent class)
2. Use data attributes
3. Use :first-child or :last-child

### Issue: Jobs load but details are wrong
**Solution:** Company/title selectors are incorrect

**Try:**
1. Inspect job detail page (not list page)
2. Update companySelector and titleSelector
3. Test in browser console first

---

## Quick Reference Card

| Platform | Primary Element | Common Classes |
|----------|----------------|----------------|
| Himalayas | `<a>` links | `.job-card`, `.company-name` |
| RemoteOK | `<tr>` rows | `.job`, `h2`, `h3` |
| WWR | `<li>` items | `.feature`, `.company`, `.title` |
| Jobgether | `<div>` cards | `[data-testid]`, `.job-card` |
| BuiltIn | `<article>` | `[data-job-id]`, `.company-title` |
| ZipRecruiter | `<a>` links | `[data-job-id]`, `.job_title` |
| Jobright | `<div>` cards | `[data-testid]`, `.company` |

---

## Tips for Success

1. ✅ **Test in browser first** - Always verify selectors work in browser console
2. ✅ **Use multiple fallbacks** - Comma-separated selectors provide backups
3. ✅ **Check dynamic content** - Some sites load jobs via JavaScript (wait for load)
4. ✅ **Look for data attributes** - Often more stable than classes
5. ✅ **Keep it simple** - Start with basic selectors, add specificity if needed
6. ✅ **Document changes** - Note what works in Actions tab
7. ✅ **Test after updates** - Verify scraper finds jobs after selector changes

---

**Last Updated:** 2025-10-11  
**App Version:** 1.0.0

