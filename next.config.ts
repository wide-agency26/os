import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "puppeteer-core",
    "@sparticuz/chromium",
    "sharp",
  ],
  outputFileTracingIncludes: {
    "/api/ci-builder/figma/canvas-script": [
      "./figma-plugins/wide-os-ci-canvas/run.js",
    ],
    "/api/pdf": ["./node_modules/@sparticuz/chromium/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/app/home",
        permanent: false,
      },
      {
        source: "/home",
        destination: "/app/home",
        permanent: false,
      },
      {
        source: "/app",
        destination: "/app/home",
        permanent: false,
      },
      {
        source: "/app/bd",
        destination: "/app/work?view=board",
        permanent: true,
      },
      {
        source: "/app/bd/dashboard",
        destination: "/app/work?view=board",
        permanent: true,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "prospecting" }],
        destination: "/app/work/prospects",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "lead" }],
        destination: "/app/work/leads",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "live" }],
        destination: "/app/work/clients",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "clients" }],
        destination: "/app/work/clients",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "archive" }],
        destination: "/app/work/archived",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "done" }],
        destination: "/app/work/archived?filter=done",
        permanent: false,
      },
      {
        source: "/app/work",
        has: [{ type: "query", key: "filter", value: "lose" }],
        destination: "/app/work/archived?filter=lose",
        permanent: false,
      },
      {
        source: "/app/bd/qualification",
        destination: "/app/work/prospects?filter=qualify",
        permanent: true,
      },
      {
        source: "/app/bd/qualification/:id",
        destination: "/app/work/qualify/:id",
        permanent: true,
      },
      {
        source: "/app/bd/lms",
        destination: "/app/work/sow",
        permanent: true,
      },
      {
        source: "/app/bd/lms/new",
        destination: "/app/work/sow/new",
        permanent: true,
      },
      {
        source: "/app/bd/lms/:sow_id/print",
        destination: "/app/work/sow/:sow_id/print",
        permanent: true,
      },
      {
        source: "/app/bd/lms/:sow_id",
        destination: "/app/work/sow/:sow_id",
        permanent: true,
      },
      {
        source: "/app/bd/proposal",
        destination: "/app/work/propose",
        permanent: true,
      },
      {
        source: "/app/bd/proposal/slides/new",
        destination: "/app/work/propose",
        permanent: true,
      },
      {
        source: "/app/bd/proposal/slides/:id",
        destination: "/app/work/propose",
        permanent: true,
      },
      {
        source: "/app/bd/contract",
        destination: "/app/work/contract",
        permanent: true,
      },
      {
        source: "/app/bd/contract/:id",
        destination: "/app/work/contract/:id",
        permanent: true,
      },
      {
        source: "/app/bd/quotation",
        destination: "/app/work/quotes",
        permanent: true,
      },
      {
        source: "/app/bd/quotation/:id",
        destination: "/app/work/quotes/:id",
        permanent: true,
      },
      {
        source: "/app/bd/discovery",
        destination: "/app/tools/find",
        permanent: true,
      },
      {
        source: "/app/work/find",
        destination: "/app/tools/find",
        permanent: true,
      },
      {
        source: "/app/bd/:id",
        destination: "/app/work/pipeline/:id",
        permanent: true,
      },
      {
        source: "/app/projects",
        destination: "/app/work",
        permanent: true,
      },
      {
        source: "/app/projects/ci-builder",
        destination: "/app/tools/ci",
        permanent: true,
      },
      {
        source: "/app/projects/report",
        destination: "/app/tools/reports",
        permanent: true,
      },
      {
        source: "/app/seo-audit",
        destination: "/app/seo",
        permanent: true,
      },
      {
        source: "/app/seo-audit/:id",
        destination: "/app/seo",
        permanent: true,
      },
      {
        source: "/app/company-overview",
        destination: "/app/home",
        permanent: true,
      },
      {
        source: "/app/crm/directory",
        destination: "/app/crm",
        permanent: true,
      },
      {
        source: "/app/client-access",
        destination: "/app/crm/access",
        permanent: true,
      },
      {
        source: "/app/crm/users",
        destination: "/app/crm/access",
        permanent: true,
      },
      {
        source: "/app/work/propose/:projectId/:scopeId([0-9a-fA-F-]{36})",
        destination: "/app/work/propose/:projectId/scope/:scopeId",
        permanent: false,
      },
      {
        source:
          "/app/work/propose/:projectId/:scopeId([0-9a-fA-F-]{36})/:strategyId/:page",
        destination:
          "/app/work/propose/:projectId/scope/:scopeId/:strategyId/:page",
        permanent: false,
      },
      {
        source:
          "/app/work/propose/:projectId/:scopeId([0-9a-fA-F-]{36})/:strategyId",
        destination: "/app/work/propose/:projectId/scope/:scopeId/:strategyId",
        permanent: false,
      },
      {
        source: "/app/blog-builder",
        destination: "/app/tools/blog",
        permanent: false,
      },
      {
        source: "/app/blog-builder/:project_id([0-9a-fA-F-]{36})/:article_id",
        destination: "/app/projects/:project_id/blog/:article_id",
        permanent: false,
      },
      {
        source: "/app/blog-builder/:project_id([0-9a-fA-F-]{36})",
        destination: "/app/projects/:project_id/blog",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
