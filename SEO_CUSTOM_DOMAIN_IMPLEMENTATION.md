# SEO & Custom Domain Implementation
## Full technical spec — per-institute SEO meta tags, sitemap, robots.txt, structured data, and domain-aware rendering

---

## Table of Contents

- [Part 01 — Problem Statement & What's Missing](#part-01)
- [Part 02 — What "SEO for a Custom Domain" Means Here](#part-02)
- [Part 03 — Backend: New SEO Fields on Institute](#part-03)
- [Part 04 — Backend: New API Endpoints](#part-04)
- [Part 05 — Backend: Migration](#part-05)
- [Part 06 — Backend: Dynamic Sitemap & Robots.txt Endpoints](#part-06)
- [Part 07 — Backend: Structured Data (JSON-LD) Endpoint](#part-07)
- [Part 08 — Frontend: TenantContext SEO Application](#part-08)
- [Part 09 — Frontend: React Helmet / Head Management](#part-09)
- [Part 10 — Frontend: Institute Settings — SEO Tab](#part-10)
- [Part 11 — Frontend: New Files Summary](#part-11)
- [Part 12 — Nginx / Reverse Proxy Configuration](#part-12)
- [Part 13 — DNS Setup Guide (for institute admins)](#part-13)
- [Part 14 — Full File Change List](#part-14)

---

<a name="part-01"></a>
## Part 01 — Problem Statement & What's Missing

When an institute sets a custom domain like `lms.royalcollege.lk`, the following currently happen:

**What works:**
- Branding is loaded (`TenantContext` fetches `GET /v2/tenant/branding/domain/:domain`)
- Favicon is applied (`document.querySelectorAll("link[rel~='icon']")`)
- `document.title` is set to `customAppName`

**What is completely missing:**
1. `<meta name="description">` — every page on every custom domain returns Suraksha's default description
2. `<meta property="og:title">` / `og:image` / `og:url` — same problem; social share cards show Suraksha branding, not the institute
3. `<meta name="robots">` — no control per domain; Google crawls login page on custom domains
4. `<link rel="canonical">` — not set; canonical is `lms.suraksha.lk`, not the custom domain
5. `/sitemap.xml` — returns 404 on every custom domain
6. `/robots.txt` — returns 404 on every custom domain; Google defaults to allowing everything including internal pages
7. Structured data (JSON-LD `Organization` schema) — missing entirely
8. `<html lang="">` attribute — not set per institute language
9. `<meta name="theme-color">` — not updated with institute primary color
10. `<meta name="apple-mobile-web-app-title">` — not set per institute

---

<a name="part-02"></a>
## Part 02 — What "SEO for a Custom Domain" Means Here

The LMS is a React SPA. For SEO to work correctly on custom domains:

### What search engines see on a custom domain
```
lms.royalcollege.lk/
  → HTML shell (index.html, React SPA)
  → JS renders the login page
  → No server-rendered meta tags ← THIS IS THE PROBLEM
```

### The fix: inject meta tags at runtime before first paint

Since this is a React SPA served as static HTML + JS, the approach is:
1. Backend exposes a **`GET /v2/tenant/seo/:domain`** endpoint returning all SEO data for a domain
2. `TenantContext` fetches this alongside branding on load
3. `react-helmet-async` (or direct DOM manipulation) injects `<head>` tags before React renders
4. Backend also serves `/sitemap.xml` and `/robots.txt` dynamically per domain via the API server

For **subdomain logins** (`royalcollege.suraksha.lk`), the same flow applies — branding endpoint already resolves by subdomain, SEO endpoint does the same.

### What Google actually indexes on a custom domain
- The login page (public) → should have good meta tags
- The app pages (behind auth) → should have `<meta name="robots" content="noindex">` to prevent crawling authenticated content
- `/sitemap.xml` → should return the login page URL only
- `/robots.txt` → should block `/institute/`, `/class/`, `/subject/` paths

---

<a name="part-03"></a>
## Part 03 — Backend: New SEO Fields on Institute

### New columns to add to `institutes` table

```sql
ALTER TABLE institutes
  ADD COLUMN seo_title          VARCHAR(70)   NULL COMMENT 'Custom <title> for login page (55-65 chars ideal)',
  ADD COLUMN seo_description    VARCHAR(160)  NULL COMMENT 'Meta description for login page (max 160 chars)',
  ADD COLUMN seo_keywords       VARCHAR(500)  NULL COMMENT 'Comma-separated keywords (optional, low priority)',
  ADD COLUMN og_image_url       VARCHAR(500)  NULL COMMENT 'Open Graph image URL (1200x630px ideal)',
  ADD COLUMN twitter_handle     VARCHAR(50)   NULL COMMENT 'Twitter/X handle e.g. @RoyalCollegeLK',
  ADD COLUMN seo_noindex        TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1 = add noindex to login page (hides from Google)',
  ADD COLUMN structured_data_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = inject JSON-LD Organization schema';
```

### Update `InstituteEntity`

**File:** `src/modules/institute/entities/institute.entity.ts`

Add after the `poweredByVisible` column:

```typescript
// ── SEO Fields ──────────────────────────────────────────────────────────────

@Column({ name: 'seo_title', type: 'varchar', length: 70, nullable: true,
  comment: 'Custom <title> for login page on subdomain/custom domain (55-65 chars ideal)' })
seoTitle?: string;

@Column({ name: 'seo_description', type: 'varchar', length: 160, nullable: true,
  comment: 'Meta description for login page (max 160 chars)' })
seoDescription?: string;

@Column({ name: 'seo_keywords', type: 'varchar', length: 500, nullable: true,
  comment: 'Comma-separated SEO keywords (optional)' })
seoKeywords?: string;

@Column({ name: 'og_image_url', type: 'varchar', length: 500, nullable: true,
  comment: 'Open Graph image URL shown in social shares (1200×630px ideal)' })
ogImageUrl?: string;

@Column({ name: 'twitter_handle', type: 'varchar', length: 50, nullable: true,
  comment: 'Twitter/X handle e.g. @RoyalCollegeLK' })
twitterHandle?: string;

@Column({ name: 'seo_noindex', type: 'tinyint', default: 0,
  comment: '1 = tell Google not to index the login page' })
seoNoindex: boolean;

@Column({ name: 'structured_data_enabled', type: 'tinyint', default: 1,
  comment: '1 = inject JSON-LD Organization schema on login page' })
structuredDataEnabled: boolean;
```

### Extend `InstituteBrandingResponse` DTO

**File:** `src/modules/tenant/dto/tenant.dto.ts`

Add to the `InstituteBrandingResponse` interface/class:

```typescript
// SEO fields — included in branding response so frontend can apply them in one fetch
seoTitle?: string | null;
seoDescription?: string | null;
seoKeywords?: string | null;
ogImageUrl?: string | null;
twitterHandle?: string | null;
seoNoindex?: boolean;
structuredDataEnabled?: boolean;
// Derived fields (backend computes these)
canonicalUrl?: string;          // full URL: https://lms.royalcollege.lk
loginPageUrl?: string;          // same as canonicalUrl (for og:url)
```

### Extend `toBrandingResponse()` in TenantService

In `tenant.service.ts`, update the `toBrandingResponse` private method to include SEO fields:

```typescript
private toBrandingResponse(institute: InstituteEntity): InstituteBrandingResponse {
  // ... existing fields ...
  const canonicalUrl = institute.customDomain
    ? `https://${institute.customDomain}`
    : institute.subdomain
      ? `https://${institute.subdomain}.suraksha.lk`
      : null;

  return {
    // ... existing fields ...
    seoTitle: institute.seoTitle ?? null,
    seoDescription: institute.seoDescription ?? null,
    seoKeywords: institute.seoKeywords ?? null,
    ogImageUrl: institute.ogImageUrl ?? null,
    twitterHandle: institute.twitterHandle ?? null,
    seoNoindex: institute.seoNoindex ?? false,
    structuredDataEnabled: institute.structuredDataEnabled ?? true,
    canonicalUrl,
    loginPageUrl: canonicalUrl,
  };
}
```

Also update the `select:` array in `resolveBySubdomain()` and `resolveByCustomDomain()` to include these new fields:

```typescript
select: [
  // ... existing fields ...
  'seoTitle', 'seoDescription', 'seoKeywords', 'ogImageUrl',
  'twitterHandle', 'seoNoindex', 'structuredDataEnabled',
],
```

---

<a name="part-04"></a>
## Part 04 — Backend: New API Endpoints

### New endpoints in `TenantController`

**File:** `src/modules/tenant/tenant.controller.ts`

```typescript
// ── SEO Settings ──────────────────────────────────────────────────

@UseGuards(FlexibleAccessGuard)
@RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
@Patch('institutes/:id/seo')
@ApiOperation({ summary: 'Update SEO settings for institute login page' })
async updateSeoSettings(
  @Param('id') id: string,
  @Body() dto: UpdateSeoSettingsDto,
) {
  return this.tenantService.updateSeoSettings(id, dto);
}

@UseGuards(FlexibleAccessGuard)
@RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
@Get('institutes/:id/seo')
@ApiOperation({ summary: 'Get SEO settings for institute login page' })
async getSeoSettings(@Param('id') id: string) {
  return this.tenantService.getSeoSettings(id);
}
```

### New DTO

**File:** `src/modules/tenant/dto/tenant.dto.ts` — add:

```typescript
export class UpdateSeoSettingsDto {
  @IsOptional() @IsString() @MaxLength(70)
  seoTitle?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  seoDescription?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  seoKeywords?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  ogImageUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(50)
  twitterHandle?: string | null;

  @IsOptional() @IsBoolean()
  seoNoindex?: boolean;

  @IsOptional() @IsBoolean()
  structuredDataEnabled?: boolean;
}
```

### New Service Methods

**File:** `src/modules/tenant/tenant.service.ts` — add:

```typescript
async updateSeoSettings(instituteId: string, dto: UpdateSeoSettingsDto): Promise<void> {
  const institute = await this.instituteRepository.findOne({ where: { id: instituteId } });
  if (!institute) throw new NotFoundException('Institute not found');

  if (dto.seoTitle      !== undefined) institute.seoTitle      = dto.seoTitle;
  if (dto.seoDescription!== undefined) institute.seoDescription= dto.seoDescription;
  if (dto.seoKeywords   !== undefined) institute.seoKeywords   = dto.seoKeywords;
  if (dto.ogImageUrl    !== undefined) institute.ogImageUrl    = dto.ogImageUrl;
  if (dto.twitterHandle !== undefined) institute.twitterHandle = dto.twitterHandle;
  if (dto.seoNoindex    !== undefined) institute.seoNoindex    = dto.seoNoindex;
  if (dto.structuredDataEnabled !== undefined) institute.structuredDataEnabled = dto.structuredDataEnabled;

  institute.updatedAt = now();
  await this.instituteRepository.save(institute);
}

async getSeoSettings(instituteId: string): Promise<{
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  seoNoindex: boolean;
  structuredDataEnabled: boolean;
}> {
  const institute = await this.instituteRepository.findOne({
    where: { id: instituteId },
    select: ['seoTitle', 'seoDescription', 'seoKeywords', 'ogImageUrl', 'twitterHandle', 'seoNoindex', 'structuredDataEnabled'],
  });
  if (!institute) throw new NotFoundException('Institute not found');
  return {
    seoTitle: institute.seoTitle ?? null,
    seoDescription: institute.seoDescription ?? null,
    seoKeywords: institute.seoKeywords ?? null,
    ogImageUrl: institute.ogImageUrl ?? null,
    twitterHandle: institute.twitterHandle ?? null,
    seoNoindex: institute.seoNoindex ?? false,
    structuredDataEnabled: institute.structuredDataEnabled ?? true,
  };
}
```

---

<a name="part-05"></a>
## Part 05 — Backend: Migration

**File:** `src/migrations/1791000000000-AddSeoFieldsToInstitutes.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeoFieldsToInstitutes1791000000000 implements MigrationInterface {
  private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return parseInt(row.cnt, 10) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const cols: Array<[string, string]> = [
      ['seo_title',               'VARCHAR(70) NULL COMMENT "Custom <title> for login page (55-65 chars ideal)"'],
      ['seo_description',         'VARCHAR(160) NULL COMMENT "Meta description (max 160 chars)"'],
      ['seo_keywords',            'VARCHAR(500) NULL COMMENT "Comma-separated SEO keywords"'],
      ['og_image_url',            'VARCHAR(500) NULL COMMENT "Open Graph image URL (1200x630px)"'],
      ['twitter_handle',          'VARCHAR(50) NULL COMMENT "Twitter/X handle e.g. @RoyalCollegeLK"'],
      ['seo_noindex',             'TINYINT(1) NOT NULL DEFAULT 0 COMMENT "1=noindex login page"'],
      ['structured_data_enabled', 'TINYINT(1) NOT NULL DEFAULT 1 COMMENT "1=inject JSON-LD Organization schema"'],
    ];

    for (const [col, definition] of cols) {
      if (!(await this.columnExists(queryRunner, 'institutes', col))) {
        await queryRunner.query(`ALTER TABLE institutes ADD COLUMN ${col} ${definition}`);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const cols = ['seo_title', 'seo_description', 'seo_keywords', 'og_image_url', 'twitter_handle', 'seo_noindex', 'structured_data_enabled'];
    for (const col of cols) {
      if (await this.columnExists(queryRunner, 'institutes', col)) {
        await queryRunner.query(`ALTER TABLE institutes DROP COLUMN ${col}`);
      }
    }
  }
}
```

---

<a name="part-06"></a>
## Part 06 — Backend: Dynamic Sitemap & Robots.txt Endpoints

These two endpoints are served by the NestJS API but proxied to the root of the custom domain. The Nginx config in Part 12 handles routing `/sitemap.xml` and `/robots.txt` requests from any custom domain to the API.

### Add to `TenantController`

```typescript
// ── Public SEO: Sitemap & Robots ──────────────────────────────────

@Public()
@Get('sitemap/:domain')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@ApiOperation({ summary: 'Generate sitemap.xml for a custom domain or subdomain' })
async getSitemapForDomain(
  @Param('domain') domain: string,
  @Res() res: Response,
) {
  const xml = await this.tenantService.generateSitemapXml(domain);
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
  return res.send(xml);
}

@Public()
@Get('robots/:domain')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@ApiOperation({ summary: 'Generate robots.txt for a custom domain or subdomain' })
async getRobotsForDomain(
  @Param('domain') domain: string,
  @Res() res: Response,
) {
  const txt = await this.tenantService.generateRobotsTxt(domain);
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  return res.send(txt);
}
```

### Add to `TenantService`

```typescript
async generateSitemapXml(domain: string): Promise<string> {
  // Resolve the institute for this domain
  const institute = await this.instituteRepository.findOne({
    where: [
      { customDomain: domain, isActive: true, customDomainVerified: true },
      { subdomain: domain, isActive: true },
    ],
    select: ['id', 'customDomain', 'subdomain', 'updatedAt'],
  });

  const baseUrl = institute?.customDomain
    ? `https://${institute.customDomain}`
    : institute?.subdomain
      ? `https://${institute.subdomain}.suraksha.lk`
      : `https://${domain}`;

  const lastmod = institute?.updatedAt
    ? institute.updatedAt.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // Only the login/home page is public — everything else requires auth
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
}

async generateRobotsTxt(domain: string): Promise<string> {
  const institute = await this.instituteRepository.findOne({
    where: [
      { customDomain: domain, isActive: true, customDomainVerified: true },
      { subdomain: domain, isActive: true },
    ],
    select: ['id', 'customDomain', 'subdomain', 'seoNoindex'],
  });

  const baseUrl = institute?.customDomain
    ? `https://${institute.customDomain}`
    : institute?.subdomain
      ? `https://${institute.subdomain}.suraksha.lk`
      : `https://${domain}`;

  // If noindex flag is set, block all crawling
  if (institute?.seoNoindex) {
    return `User-agent: *\nDisallow: /\n`;
  }

  // Allow login page, block all authenticated app routes
  return `User-agent: *
Allow: /$
Allow: /login
Disallow: /institute/
Disallow: /class/
Disallow: /subject/
Disallow: /dashboard
Disallow: /profile
Disallow: /settings
Disallow: /users
Disallow: /students
Disallow: /teachers
Disallow: /parents
Disallow: /attendance
Disallow: /homework
Disallow: /exams
Disallow: /results
Disallow: /payments
Disallow: /lectures

Sitemap: ${baseUrl}/sitemap.xml
`;
}
```

---

<a name="part-07"></a>
## Part 07 — Backend: Structured Data (JSON-LD) Endpoint

The branding response already returns enough data to generate JSON-LD on the frontend. No extra endpoint needed — the frontend builds it from branding data.

**JSON-LD shape the frontend generates:**

```json
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "Royal College Colombo",
  "url": "https://lms.royalcollege.lk",
  "logo": "https://storage.suraksha.lk/institutes/109/logo.png",
  "description": "Online learning platform for Royal College Colombo students",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "LK"
  },
  "sameAs": [
    "https://www.facebook.com/royalcollegelk",
    "https://www.youtube.com/@royalcollegelk"
  ]
}
```

This is injected via a `<script type="application/ld+json">` tag in `<head>` — handled in Part 09.

---

<a name="part-08"></a>
## Part 08 — Frontend: TenantContext SEO Application

### Edit: `src/contexts/TenantContext.tsx`

The `TenantBranding` interface and the `fetchBranding` effect need to be extended to apply all SEO-related head tags.

#### Step 1 — Extend `TenantBranding` interface

Add the new fields:

```typescript
export interface TenantBranding {
  // ... existing fields ...
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  ogImageUrl: string | null;
  twitterHandle: string | null;
  seoNoindex: boolean;
  structuredDataEnabled: boolean;
  canonicalUrl: string | null;
  loginPageUrl: string | null;
  // These already exist (from institute settings):
  websiteUrl?: string | null;
  facebookPageUrl?: string | null;
  youtubeChannelUrl?: string | null;
  city?: string | null;
  country?: string | null;
  description?: string | null;
}
```

#### Step 2 — Replace the head-tag application block in `fetchBranding`

After `setBranding(data)`, replace the existing favicon + title code with a comprehensive head manager:

```typescript
// ── Apply all SEO head tags ────────────────────────────────────────
applyTenantHeadTags(data);
```

#### Step 3 — New function `applyTenantHeadTags`

Add this utility function inside `TenantContext.tsx` (outside the component):

```typescript
function setMeta(name: string, content: string | null | undefined, isProperty = false) {
  if (!content) return;
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string | null | undefined, extra?: Record<string, string>) {
  if (!href) return;
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
  }
}

function applyTenantHeadTags(data: TenantBranding) {
  // ── 1. Page title ─────────────────────────────────────────────────
  const title = data.seoTitle || data.customAppName || data.name;
  if (title) document.title = title;

  // ── 2. Meta description ───────────────────────────────────────────
  setMeta('description', data.seoDescription);

  // ── 3. Meta keywords (low SEO value but harmless) ─────────────────
  setMeta('keywords', data.seoKeywords);

  // ── 4. Robots ─────────────────────────────────────────────────────
  setMeta('robots', data.seoNoindex ? 'noindex, nofollow' : 'index, follow');

  // ── 5. Canonical URL ──────────────────────────────────────────────
  setLink('canonical', data.canonicalUrl);

  // ── 6. Favicon ────────────────────────────────────────────────────
  if (data.faviconUrl) {
    const resolvedFavicon = getImageUrl(data.faviconUrl);
    document.querySelectorAll("link[rel~='icon'], link[rel~='shortcut']").forEach(el => {
      (el as HTMLLinkElement).href = resolvedFavicon;
    });
    if (!document.querySelector("link[rel~='icon']")) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = resolvedFavicon;
      document.head.appendChild(link);
    }
    // Apple touch icon
    setLink('apple-touch-icon', resolvedFavicon);
  }

  // ── 7. Theme color (matches primary brand color) ──────────────────
  setMeta('theme-color', data.primaryColorCode);
  setMeta('msapplication-TileColor', data.primaryColorCode);

  // ── 8. Open Graph tags ────────────────────────────────────────────
  setMeta('og:type',        'website',                    true);
  setMeta('og:site_name',   data.customAppName || data.name, true);
  setMeta('og:title',       data.seoTitle || data.customAppName || data.name, true);
  setMeta('og:description', data.seoDescription,          true);
  setMeta('og:url',         data.loginPageUrl,             true);
  setMeta('og:image',       data.ogImageUrl
    ? getImageUrl(data.ogImageUrl)
    : data.logoUrl
      ? getImageUrl(data.logoUrl)
      : null,                                              true);
  setMeta('og:locale',      'en_US',                      true);

  // ── 9. Twitter / X card tags ──────────────────────────────────────
  setMeta('twitter:card',        'summary_large_image');
  setMeta('twitter:title',       data.seoTitle || data.customAppName || data.name);
  setMeta('twitter:description', data.seoDescription);
  setMeta('twitter:image',       data.ogImageUrl
    ? getImageUrl(data.ogImageUrl)
    : data.logoUrl
      ? getImageUrl(data.logoUrl)
      : null);
  if (data.twitterHandle) setMeta('twitter:site', data.twitterHandle);

  // ── 10. Mobile web app meta ───────────────────────────────────────
  setMeta('apple-mobile-web-app-title', data.customAppName || data.name);
  setMeta('application-name',           data.customAppName || data.name);
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('mobile-web-app-capable', 'yes');

  // ── 11. HTML lang attribute ───────────────────────────────────────
  // Default to 'en' unless institute is in a Sinhala/Tamil context
  // (can be extended when per-institute language is added)
  if (!document.documentElement.getAttribute('lang')) {
    document.documentElement.setAttribute('lang', 'en');
  }

  // ── 12. Structured data (JSON-LD) ─────────────────────────────────
  if (data.structuredDataEnabled) {
    injectStructuredData(data);
  }
}

function injectStructuredData(data: TenantBranding) {
  // Remove existing JSON-LD if any
  document.querySelectorAll('script[type="application/ld+json"][data-tenant="true"]').forEach(el => el.remove());

  const sameAs: string[] = [];
  if (data.facebookPageUrl) sameAs.push(data.facebookPageUrl);
  if (data.youtubeChannelUrl) sameAs.push(data.youtubeChannelUrl);
  if (data.websiteUrl) sameAs.push(data.websiteUrl);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: data.name,
    url: data.canonicalUrl || data.loginPageUrl,
    description: data.seoDescription || data.description,
  };

  if (data.logoUrl) {
    schema.logo = {
      '@type': 'ImageObject',
      url: getImageUrl(data.logoUrl),
    };
  }

  if (data.city || data.country) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(data.city    ? { addressLocality: data.city }    : {}),
      ...(data.country ? { addressCountry: data.country }  : {}),
    };
  }

  if (sameAs.length > 0) schema.sameAs = sameAs;

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-tenant', 'true');
  script.textContent = JSON.stringify(schema, null, 2);
  document.head.appendChild(script);
}
```

---

<a name="part-09"></a>
## Part 09 — Frontend: React Helmet / Head Management

The direct DOM approach in Part 08 works for tenant login pages. For the rest of the SPA (post-login pages), add `react-helmet-async` for per-route head management.

### Install

```bash
npm install react-helmet-async
```

### Wrap app in `HelmetProvider`

**File:** `src/main.tsx` (or wherever the root providers are)

```tsx
import { HelmetProvider } from 'react-helmet-async';

// Wrap the entire app:
<HelmetProvider>
  <TenantProvider>
    <App />
  </TenantProvider>
</HelmetProvider>
```

### New utility: `src/components/seo/TenantHelmet.tsx`

A component used inside logged-in pages to set page-level meta tags. For authenticated routes, we always set `noindex`.

```tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTenant } from '@/contexts/TenantContext';

interface Props {
  pageTitle?: string;   // e.g. "Dashboard" — prepended to site name
  noindex?: boolean;    // defaults to true for all logged-in pages
}

export const TenantHelmet: React.FC<Props> = ({ pageTitle, noindex = true }) => {
  const { branding, isTenantLogin } = useTenant();
  if (!isTenantLogin || !branding) return null;

  const siteName = branding.customAppName || branding.name;
  const fullTitle = pageTitle ? `${pageTitle} — ${siteName}` : siteName;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:site_name" content={siteName} />
    </Helmet>
  );
};
```

**Usage in any page component (optional — only for tenant logins):**

```tsx
// In Dashboard.tsx:
import { TenantHelmet } from '@/components/seo/TenantHelmet';

const Dashboard = () => (
  <>
    <TenantHelmet pageTitle="Dashboard" />
    {/* ... rest of dashboard ... */}
  </>
);
```

---

<a name="part-10"></a>
## Part 10 — Frontend: Institute Settings — SEO Tab

### Edit: `src/pages/InstituteSettingsPage.tsx`

#### Change 1 — Add `seo` to `VALID_TABS`

```typescript
const VALID_TABS = [...existing..., 'seo'];
```

#### Change 2 — Add to `SECTION_ITEMS`

```typescript
{ id: 'seo', label: 'SEO & Discoverability', description: 'Search engine title, description, sitemap', icon: Search, color: 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300' },
```

`Search` is already imported from lucide-react in this file. If not, add it.

#### Change 3 — Add tab render

```tsx
{activeTab === 'seo' && isInstituteAdmin && instituteId && (
  <SeoSettings instituteId={instituteId} settings={settings} />
)}
```

### New file: `src/components/institute-settings/SeoSettings.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { Loader2, ExternalLink, Info, Search, Globe } from 'lucide-react';

interface SeoData {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogImageUrl: string;
  twitterHandle: string;
  seoNoindex: boolean;
  structuredDataEnabled: boolean;
}

interface Props {
  instituteId: string;
  settings: { subdomain?: string; customDomain?: string; name?: string } | null;
}

export const SeoSettings: React.FC<Props> = ({ instituteId, settings }) => {
  const { toast } = useToast();
  const [form, setForm] = useState<SeoData>({
    seoTitle: '', seoDescription: '', seoKeywords: '',
    ogImageUrl: '', twitterHandle: '',
    seoNoindex: false, structuredDataEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const publicUrl = settings?.customDomain
    ? `https://${settings.customDomain}`
    : settings?.subdomain
      ? `https://${settings.subdomain}.suraksha.lk`
      : null;

  useEffect(() => {
    if (!instituteId) return;
    setLoading(true);
    enhancedCachedClient.get<SeoData>(
      `/v2/tenant/institutes/${instituteId}/seo`,
      {},
      { ttl: 60, forceRefresh: true },
    )
      .then(data => setForm({
        seoTitle: data.seoTitle ?? '',
        seoDescription: data.seoDescription ?? '',
        seoKeywords: data.seoKeywords ?? '',
        ogImageUrl: data.ogImageUrl ?? '',
        twitterHandle: data.twitterHandle ?? '',
        seoNoindex: data.seoNoindex ?? false,
        structuredDataEnabled: data.structuredDataEnabled ?? true,
      }))
      .catch(() => toast({ title: 'Error', description: 'Failed to load SEO settings.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [instituteId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await enhancedCachedClient.patch(
        `/v2/tenant/institutes/${instituteId}/seo`,
        form,
        { instituteId },
      );
      toast({ title: 'Saved', description: 'SEO settings updated.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-40">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );

  const titleLen = form.seoTitle.length;
  const descLen  = form.seoDescription.length;

  return (
    <div className="space-y-6">

      {/* Domain status banner */}
      {publicUrl && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Your public URL:
              </span>
              <code className="text-sm text-green-800 dark:text-green-200">{publicUrl}</code>
            </div>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 text-green-600" />
            </a>
          </CardContent>
        </Card>
      )}

      {!publicUrl && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              SEO settings only apply when your institute has a subdomain or custom domain configured.
              Go to <strong>Domain & Login Page</strong> to set one up.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4" /> Google Search Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 space-y-1 max-w-lg">
            <p className="text-xs text-green-700 dark:text-green-400 truncate">
              {publicUrl ?? 'https://your-domain.suraksha.lk'}
            </p>
            <p className="text-blue-700 dark:text-blue-400 text-lg font-medium leading-tight truncate">
              {form.seoTitle || settings?.name || 'Your Institute Name'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
              {form.seoDescription || 'Add a description to appear here in Google search results.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SEO Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Page Title & Description</CardTitle>
          <CardDescription className="text-xs">
            Shown in Google search results and browser tab. Only affects the login page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>SEO Title</Label>
              <span className={`text-xs ${titleLen > 65 ? 'text-destructive' : titleLen > 55 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {titleLen}/65
              </span>
            </div>
            <Input
              value={form.seoTitle}
              onChange={e => setForm(p => ({ ...p, seoTitle: e.target.value }))}
              placeholder={`${settings?.name ?? 'Your Institute'} — Learning Management System`}
              maxLength={70}
            />
            <p className="text-[11px] text-muted-foreground">Keep between 55–65 characters for best results.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Meta Description</Label>
              <span className={`text-xs ${descLen > 160 ? 'text-destructive' : descLen > 140 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                {descLen}/160
              </span>
            </div>
            <Textarea
              value={form.seoDescription}
              onChange={e => setForm(p => ({ ...p, seoDescription: e.target.value }))}
              placeholder="Online learning platform for students of Royal College Colombo. Access classes, homework, exams, and results."
              maxLength={160}
              rows={3}
            />
            <p className="text-[11px] text-muted-foreground">Keep under 160 characters. Summarize what the platform offers.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Keywords <span className="text-xs text-muted-foreground">(optional, low impact)</span></Label>
            <Input
              value={form.seoKeywords}
              onChange={e => setForm(p => ({ ...p, seoKeywords: e.target.value }))}
              placeholder="e.g. Royal College, LMS, online learning, Colombo"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social sharing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Social Media (Open Graph)</CardTitle>
          <CardDescription className="text-xs">
            Controls what appears when your link is shared on WhatsApp, Facebook, LinkedIn etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Social Share Image URL</Label>
            <Input
              value={form.ogImageUrl}
              onChange={e => setForm(p => ({ ...p, ogImageUrl: e.target.value }))}
              placeholder="https://storage.suraksha.lk/institutes/109/og-image.png"
            />
            <p className="text-[11px] text-muted-foreground">
              Ideal size: 1200×630px. If empty, your institute logo is used instead.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Twitter / X Handle</Label>
            <Input
              value={form.twitterHandle}
              onChange={e => setForm(p => ({ ...p, twitterHandle: e.target.value }))}
              placeholder="@RoyalCollegeLK"
            />
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Hide from search engines</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adds <code>noindex</code> — Google will not show your login page in results.
                Also blocks <code>/sitemap.xml</code> crawling.
              </p>
            </div>
            <Switch
              checked={form.seoNoindex}
              onCheckedChange={v => setForm(p => ({ ...p, seoNoindex: v }))}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Structured Data (JSON-LD)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Injects <code>EducationalOrganization</code> schema — helps Google
                understand your institute and may enable rich results.
              </p>
            </div>
            <Switch
              checked={form.structuredDataEnabled}
              onCheckedChange={v => setForm(p => ({ ...p, structuredDataEnabled: v }))}
            />
          </div>

          {/* Sitemap & robots links */}
          {publicUrl && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Auto-generated files</p>
              <div className="flex items-center justify-between">
                <code className="text-xs">/sitemap.xml</code>
                <a
                  href={`${publicUrl}/sitemap.xml`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-xs">/robots.txt</code>
                <a
                  href={`${publicUrl}/robots.txt`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save SEO Settings
      </Button>
    </div>
  );
};
```

---

<a name="part-11"></a>
## Part 11 — Frontend: New Files Summary

### New files

```
src/
  components/
    institute-settings/
      SeoSettings.tsx              ← SEO settings form + Google preview card
    seo/
      TenantHelmet.tsx             ← Per-page noindex Helmet wrapper for tenant logins
```

### Files to edit

| File | Change |
|------|--------|
| `src/contexts/TenantContext.tsx` | Extend `TenantBranding` interface; replace favicon/title block with `applyTenantHeadTags()`; add `applyTenantHeadTags()` and `injectStructuredData()` functions |
| `src/pages/InstituteSettingsPage.tsx` | Add `seo` to `VALID_TABS`, add to `SECTION_ITEMS`, render `<SeoSettings>` for that tab |
| `src/main.tsx` | Wrap app in `<HelmetProvider>` (from react-helmet-async) |

### Package to install

```bash
npm install react-helmet-async
```

---

<a name="part-12"></a>
## Part 12 — Nginx / Reverse Proxy Configuration

When an institute has a custom domain like `lms.royalcollege.lk`, that domain must point to the same server as `lms.suraksha.lk`. The Nginx config handles:
- Serving the SPA index.html for all page routes
- Proxying `/sitemap.xml` and `/robots.txt` to the NestJS API

### Nginx virtual host config (per custom domain or wildcard)

```nginx
# /etc/nginx/sites-available/tenant-custom-domains.conf

server {
    # Catch-all for any domain that is not lms.suraksha.lk
    # Add specific server_name entries for each custom domain, OR use a wildcard cert
    listen 443 ssl http2;
    server_name ~^(?<domain>.+)$;   # match any domain

    # SSL — use a wildcard cert + Let's Encrypt for custom domains
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /var/www/lms-frontend/dist;
    index index.html;

    # ── /sitemap.xml → proxy to NestJS API ───────────────────────────
    location = /sitemap.xml {
        proxy_pass http://localhost:3000/v2/tenant/sitemap/$domain;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_valid 200 1h;
        add_header Content-Type "application/xml; charset=utf-8";
    }

    # ── /robots.txt → proxy to NestJS API ────────────────────────────
    location = /robots.txt {
        proxy_pass http://localhost:3000/v2/tenant/robots/$domain;
        proxy_set_header Host $host;
        proxy_cache_valid 200 1h;
        add_header Content-Type "text/plain; charset=utf-8";
    }

    # ── Static assets ─────────────────────────────────────────────────
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── SPA fallback — all other routes serve index.html ─────────────
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name ~^.+$;
    return 301 https://$host$request_uri;
}
```

### For subdomain logins (`royalcollege.suraksha.lk`)

Wildcard subdomain on `*.suraksha.lk` is already configured (assumed). The same Nginx block handles it — `$domain` captures `royalcollege.suraksha.lk` and is passed to the API which resolves by subdomain.

---

<a name="part-13"></a>
## Part 13 — DNS Setup Guide (for Institute Admins)

This section should be shown to the institute admin in the `SeoSettings` or `Domain & Login Page` tab as inline instructions after they enter a custom domain.

### What the admin needs to do

**Step 1 — Add a CNAME record in your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)**

```
Type:  CNAME
Name:  lms          (creates lms.royalcollege.lk)
Value: lms.suraksha.lk
TTL:   3600
```

Or for root domain (`royalcollege.lk`):
```
Type:  A
Name:  @
Value: [Suraksha LMS server IP]
TTL:   3600
```

**Step 2 — Wait for DNS propagation (usually 5–30 minutes, up to 48 hours)**

**Step 3 — Come back to Institute Settings → Domain & Login Page → Click "Verify Domain"**

### Verification flow (already implemented)

1. Admin enters domain in settings
2. `PATCH /v2/tenant/institutes/:id/custom-domain` saves it (unverified)
3. Admin clicks "Verify Domain"
4. `POST /v2/tenant/institutes/:id/verify-domain` checks DNS and marks `customDomainVerified = true`

### What to show in the UI

After saving a custom domain, show this instructional card:

```
┌─────────────────────────────────────────────────────────────┐
│ 🌐 Custom Domain Setup Instructions                          │
│                                                              │
│ 1. Login to your domain registrar (GoDaddy, Cloudflare...)  │
│ 2. Add this DNS record:                                      │
│                                                              │
│    Type: CNAME                                               │
│    Name: lms  (or your preferred prefix)                     │
│    Value: lms.suraksha.lk                                    │
│    TTL: 3600                                                  │
│                                                              │
│ 3. Wait 5–30 minutes for DNS to propagate                   │
│ 4. Click "Verify Domain" below                               │
│                                                              │
│ [Verify Domain ✓]                                            │
└─────────────────────────────────────────────────────────────┘
```

This UI already exists in `InstituteSettingsPage.tsx` in the `tenant` tab — no change needed beyond ensuring the SEO tab links back to it.

---

<a name="part-14"></a>
## Part 14 — Full File Change List

### Backend changes

| File | What changes |
|------|-------------|
| `src/modules/institute/entities/institute.entity.ts` | Add 7 SEO columns: `seoTitle`, `seoDescription`, `seoKeywords`, `ogImageUrl`, `twitterHandle`, `seoNoindex`, `structuredDataEnabled` |
| `src/modules/tenant/dto/tenant.dto.ts` | Add `UpdateSeoSettingsDto`; extend `InstituteBrandingResponse` with SEO fields + `canonicalUrl` |
| `src/modules/tenant/tenant.service.ts` | Add `updateSeoSettings()`, `getSeoSettings()`, `generateSitemapXml()`, `generateRobotsTxt()` methods; extend `toBrandingResponse()` with SEO fields; update `select:` arrays in `resolveBySubdomain()` and `resolveByCustomDomain()` |
| `src/modules/tenant/tenant.controller.ts` | Add `GET /institutes/:id/seo`, `PATCH /institutes/:id/seo`, `GET /sitemap/:domain`, `GET /robots/:domain` |
| `src/migrations/1791000000000-AddSeoFieldsToInstitutes.ts` | **NEW** — adds 7 columns, idempotent |

### Frontend changes

| File | What changes |
|------|-------------|
| `src/contexts/TenantContext.tsx` | Extend `TenantBranding` interface; replace minimal favicon+title code with full `applyTenantHeadTags()` + `injectStructuredData()`; both are standalone functions |
| `src/pages/InstituteSettingsPage.tsx` | Add `seo` to `VALID_TABS`; add SEO entry to `SECTION_ITEMS`; render `<SeoSettings>` for tab |
| `src/main.tsx` | Wrap app in `<HelmetProvider>` |
| `src/components/institute-settings/SeoSettings.tsx` | **NEW** — SEO settings form with live Google preview |
| `src/components/seo/TenantHelmet.tsx` | **NEW** — per-page Helmet for authenticated tenant pages |

### Infrastructure changes

| File | What changes |
|------|-------------|
| `nginx/tenant-custom-domains.conf` | Proxy `/sitemap.xml` and `/robots.txt` to API; SPA fallback for all other routes |

### Package

```bash
npm install react-helmet-async
```

---

## Summary: What This Achieves End-to-End

| Before | After |
|--------|-------|
| All custom domains show Suraksha meta description | Each institute has its own `seoDescription` in Google |
| Social shares show Suraksha logo | Social shares show institute's OG image or logo |
| `/sitemap.xml` returns 404 | Returns login page URL, last-modified from DB |
| `/robots.txt` returns 404 | Blocks all authenticated routes; allows login page |
| No structured data | `EducationalOrganization` JSON-LD on every login page |
| `<title>` is always "Suraksha LMS" | Title is `seoTitle` or `customAppName` or institute name |
| No canonical URL | `<link rel="canonical">` points to the correct domain |
| No theme-color | `<meta name="theme-color">` matches institute primary color |
| No per-page noindex | `TenantHelmet` adds `noindex` to all post-login pages |
| Admin can't control any of this | Full SEO tab with live Google search preview in settings |
