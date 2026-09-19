# Multi-Tenant BYOD Supabase users

# Product Requirements Document: Multi-Tenant BYOD Supabase Platform

<aside>
<img src="https://app.notion.com/icons/help-alternate_lightgray.svg" alt="https://app.notion.com/icons/help-alternate_lightgray.svg" width="40px" />

[https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration](https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration)

</aside>

## 1. Objective

Transform the existing single-database application into a multi-tenant, white-labeled SaaS platform. The platform will enable users (Tenants) to securely connect their own Supabase databases (Bring Your Own Database) via SSO, perform automated actions, and serve custom-branded interfaces to their end-customers.

## 2. Target Audience

- **Tenants (Platform Users):** Administrators or businesses using the platform to execute automated database actions on their own data.
- **End-Customers:** The Tenants' users, who interact with the platform's frontend and experience the Tenant's custom branding.

## 3. Core Features & Requirements

### 3.1. Supabase OAuth & Management Integration

- **1-Click Authorization:** Tenants connect their Supabase accounts via standard OAuth 2.0 flow (no manual API key copy-pasting).
- **Project Discovery:** The platform uses the Supabase Management API to fetch and display the Tenant’s existing databases.
- **Automated Provisioning (Optional Expansion):** The platform can automatically provision a new Supabase project for a Tenant via the Management API if they do not have one.

### 3.2. Hub & Spoke Architecture

- **Hub Database:** A central platform database to store Tenant profiles, UI theme configurations, and target database connection credentials.
- **Dynamic Client Instantiation:** The backend must dynamically instantiate Supabase clients scoped strictly to the specific Tenant’s database on a per-request basis.

### 3.3. Security & Key Management

- **Encrypted Storage:** All Tenant access tokens, refresh tokens, and target API keys must be encrypted at rest in the Hub Database using Supabase Vault (`pgsodium`).
- **Secure Decryption:** Keys will only be decrypted in memory via secure database views at the exact moment the dynamic client is instantiated.

### 3.4. Dynamic Routing & White-Labeling

- **Subdomain Routing:** The platform will use Edge Middleware to identify the Tenant based on the request URL (e.g., `tenantA.platform.com`).
- **Dynamic Theming:** The middleware will fetch the Tenant’s custom UI settings (JSON payload of colors, fonts, logos) from the Hub Database and inject them as CSS variables into the frontend before rendering, preventing styling flicker.

## 4. Key User Flows

- **Tenant Onboarding Flow:** Sign up -> Click "Connect Supabase" (OAuth) -> Select Target Project from dropdown -> Set custom brand colors/logo -> Save.
- **End-Customer Interaction Flow:** Visit Tenant subdomain -> Middleware identifies Tenant -> Fetches custom theme and DB credentials -> Renders branded UI -> User action triggers backend to execute operation on Tenant's Spoke DB.

## 5. Out of Scope (V1)

- Complex analytics dashboards for Tenants.
- Support for non-Supabase database providers (e.g., direct Firebase or AWS RDS connections).
- Custom domain mapping (restrict to platform subdomains for V1).