import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { CONTENT_CALENDAR_MCP_PLAYBOOK, CONTENT_MEDIA_MCP_DOC, CONTENT_POST_LIVE_NOTE, VISUAL_BRIEF_MCP_DOC } from "@/lib/mcp/content-tool-copy";
import {
  toolApproveAllContentAngles,
  toolApproveAllContentPosts,
  toolAssignTask,
  toolCreateClient,
  toolCreateContentPost,
  toolCreateDebugItem,
  toolCreatePerson,
  toolCreateProject,
  toolCreateSow,
  toolCreateTask,
  toolDeleteContentPost,
  toolGenerateContentMonth,
  toolGetBlogArticle,
  toolGetContentMonth,
  toolGetContentPost,
  toolGetGuideline,
  toolGetProject,
  toolGetProjectFinance,
  toolGetPublishedReport,
  toolGetSeoRun,
  toolGetSettings,
  toolGetSow,
  toolGetTask,
  toolIngestContentMediaFromUrl,
  toolListBlogArticles,
  toolListClients,
  toolListContentCalendars,
  toolListDebugItems,
  toolListGuidelines,
  toolListPeople,
  toolListProjects,
  toolListPublishedReports,
  toolListSeoSites,
  toolListSows,
  toolListTasks,
  toolLogOverride,
  toolUpdateClient,
  toolUpdateContentCalendar,
  toolUpdateContentPost,
  toolUploadContentPostMedia,
  toolUpdateDebugItem,
  toolUpdateGuideline,
  toolUpdateProject,
  toolUpdateProjectFinance,
  toolUpdateProjectProgress,
  toolUpdateSeoSite,
  toolUpdateSettings,
  toolUpdateSow,
  toolUpdateTask,
  toolUpsertBlogArticle,
  toolUpsertPublishedReport,
  toolUpsertSowLineItem,
} from "@/lib/mcp/tools";
import { authorizeMcpRequest, mcpUnauthorizedResponse } from "@/lib/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const overrideOutcomeZ = z.enum([
  "accept",
  "edit",
  "replace",
  "regenerate",
  "block",
  "cosmetic",
  "augment",
]);
const overrideTriggerZ = z.enum([
  "factually_wrong",
  "wrong_tone",
  "missing_context",
  "policy",
  "preference",
]);
const overrideSurfaceZ = z.enum([
  "chat",
  "task",
  "email",
  "guideline",
  "ci_builder",
  "report",
  "content",
  "sow",
  "bd",
  "hr",
  "other",
]);
const damQuadrantZ = z.enum(["Q1", "Q2", "Q3", "Q4"]);

/** Optional fields so create/update_task can log an override in the same call. */
const overrideAttachFields = {
  override_agent_key: z
    .string()
    .optional()
    .describe("Bot id, e.g. pm_bot | client_manager | ci_builder"),
  override_outcome: overrideOutcomeZ
    .optional()
    .describe("accept when draft ships unchanged; edit|replace|regenerate|block for disagreement"),
  override_trigger: overrideTriggerZ.nullable().optional(),
  override_surface: overrideSurfaceZ.optional(),
  override_quadrant: damQuadrantZ.nullable().optional(),
  override_alpha: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).nullable().optional(),
  override_proposed: z.string().nullable().optional(),
  override_final: z.string().nullable().optional(),
  override_by: z.string().nullable().optional().describe("Who overrode, e.g. Ali | Thomas"),
};

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_clients",
      {
        title: "List clients",
        description:
          "List CRM company clients in WIDE OS (record_kind=company). One agency-wide catalog.",
        inputSchema: z.object({}),
      },
      async () => toolListClients()
    );

    server.registerTool(
      "create_client",
      {
        title: "Create client",
        description:
          "Create a CRM company (record_kind=company) for create_project. status: Prospect|Lead|Client (default Prospect). Does not auto-create from Gmail.",
        inputSchema: z.object({
          name: z.string().min(1),
          status: z.enum(["Prospect", "Lead", "Client"]).optional(),
        }),
      },
      async (args) => toolCreateClient(args)
    );

    server.registerTool(
      "update_client",
      {
        title: "Update client",
        description:
          "Rename or set CRM status on a company client. Updates both name and company fields.",
        inputSchema: z.object({
          id: z.string().uuid(),
          name: z.string().optional(),
          status: z.enum(["Prospect", "Lead", "Client"]).optional(),
        }),
      },
      async (args) => toolUpdateClient(args)
    );

    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description: "List projects for a CRM company (client_id).",
        inputSchema: z.object({
          client_id: z.string().uuid().describe("CRM company id"),
        }),
      },
      async ({ client_id }) => toolListProjects(client_id)
    );

    server.registerTool(
      "create_project",
      {
        title: "Create project",
        description:
          "Create a project under a CRM company. status: pipeline|running|expired|completed.",
        inputSchema: z.object({
          client_id: z.string().uuid(),
          title: z.string().min(1),
          status: z.enum(["pipeline", "running", "expired", "completed"]).optional(),
          task_policy: z.enum(["locked", "default", "free"]).optional(),
        }),
      },
      async (args) => toolCreateProject(args)
    );

    server.registerTool(
      "get_project",
      {
        title: "Get project",
        description:
          "Get a project including task-retitle policy, finance summary, and client_progress snapshot.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
        }),
      },
      async ({ project_id }) => toolGetProject(project_id)
    );

    server.registerTool(
      "update_project",
      {
        title: "Update project",
        description:
          "Update project title, status, task_policy, client_id, client_visible, client_nav_tabs, or stage (portal chrome).",
        inputSchema: z.object({
          id: z.string().uuid(),
          title: z.string().optional(),
          status: z.enum(["pipeline", "running", "expired", "completed"]).optional(),
          task_policy: z.enum(["locked", "default", "free"]).optional(),
          client_id: z.string().uuid().optional(),
          client_visible: z.boolean().optional(),
          client_nav_tabs: z.array(z.string()).optional(),
          stage: z.string().optional(),
        }),
      },
      async (args) => toolUpdateProject(args)
    );

    server.registerTool(
      "update_project_progress",
      {
        title: "Update project progress",
        description:
          "Create or merge the hand-fed client progress snapshot on a project (projects.client_progress). Writes publish by default (sets published_at). Pass publish:false to update without publishing. Does not touch tasks or finance.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          progress: z
            .object({
              show_on_client: z.boolean().optional(),
              period: z.enum(["month", "last_month", "custom"]).optional(),
              period_start: z.string().optional(),
              period_end: z.string().optional(),
              summary: z.string().optional(),
              stats: z
                .array(
                  z.object({
                    key: z.enum([
                      "social_produced",
                      "social_live",
                      "landings_building",
                      "blogs_published",
                      "other",
                    ]),
                    label: z.string().optional(),
                    count: z.number().optional(),
                    note: z.string().optional(),
                  })
                )
                .optional(),
              items: z
                .array(
                  z.object({
                    id: z.string().optional(),
                    type: z.enum(["social", "landing", "blog", "other"]).optional(),
                    title: z.string(),
                    status: z
                      .enum(["live", "in_build", "scheduled", "in_review"])
                      .optional(),
                    url: z.string().optional(),
                    date: z.string().optional(),
                  })
                )
                .optional(),
            })
            .optional(),
          publish: z.boolean().optional(),
        }),
      },
      async (args) => toolUpdateProjectProgress(args)
    );

    server.registerTool(
      "list_tasks",
      {
        title: "List tasks",
        description:
          "List pm_tasks for a project. Default compact=true (metadata only — no content_blocks). Use get_task(task_id) for the full internal + client bodies.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          compact: z.boolean().optional().describe("Default true. Set false for full rows incl. content_blocks."),
        }),
      },
      async (args) => toolListTasks(args)
    );

    server.registerTool(
      "get_task",
      {
        title: "Get task",
        description:
          "Fetch one pm_tasks row including content_blocks (internal brief) and client_content_blocks (client Tasks tab).",
        inputSchema: z.object({
          task_id: z.string().uuid(),
        }),
      },
      async ({ task_id }) => toolGetTask(task_id)
    );

    server.registerTool(
      "create_task",
      {
        title: "Create task",
        description:
          "Create a pm_tasks row. status accepts us|them|parked|done or OS native statuses. source = gmail thread id or chat note. Use body_markdown (or body) for the internal BlockNote brief — not last_evidence. Use client_body_markdown for the client Tasks tab (never auto-copied from internal body). Optional content_blocks / client_content_blocks for raw BlockNote JSON. When a human reviewed your draft before create, pass override_* (including override_outcome=accept if unchanged) or call log_override — every review must be logged for the override denominator.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          title: z.string().min(1),
          status: z.string().optional(),
          waiting_on: z.enum(["us", "them"]).nullable().optional(),
          source: z.string().nullable().optional(),
          last_evidence: z.string().nullable().optional(),
          body_markdown: z.string().nullable().optional(),
          body: z.string().nullable().optional(),
          content_blocks: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
          client_body_markdown: z.string().nullable().optional(),
          client_content_blocks: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
          client_visible: z.boolean().optional(),
          ...overrideAttachFields,
        }),
      },
      async (args) => toolCreateTask(args)
    );

    server.registerTool(
      "update_task",
      {
        title: "Update task",
        description:
          "Update pm_tasks fields. Title changes are restricted by task policy (locked/default/free). Set material_change=true only when the work actually changed. Use body_markdown for internal brief; client_body_markdown for client Tasks tab. Optional project_id to move the task to another project. When a human reviewed your draft for this update, pass override_* (including accept) or call log_override — do not skip accepts.",
        inputSchema: z.object({
          task_id: z.string().uuid(),
          project_id: z.string().uuid().optional(),
          title: z.string().optional(),
          status: z.string().optional(),
          waiting_on: z.enum(["us", "them"]).nullable().optional(),
          source: z.string().nullable().optional(),
          last_evidence: z.string().nullable().optional(),
          body_markdown: z.string().nullable().optional(),
          body: z.string().nullable().optional(),
          content_blocks: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
          client_body_markdown: z.string().nullable().optional(),
          client_content_blocks: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
          material_change: z.boolean().optional(),
          client_visible: z.boolean().optional(),
          ...overrideAttachFields,
        }),
      },
      async (args) => toolUpdateTask(args)
    );

    server.registerTool(
      "log_override",
      {
        title: "Log AI review decision",
        description:
          "REQUIRED for every human review of your AI output (accept, edit, replace, regenerate, block, cosmetic, augment). Writes to ai_overrides. Logging only pushback breaks the override denominator — accept MUST be logged when the draft ships unchanged. For edit|replace|regenerate|block you MUST set override_trigger. Keep proposed_summary / final_summary short (≤500 chars). Prefer this tool when there is no matching create_task/update_task call.",
        inputSchema: z.object({
          agent_key: z
            .string()
            .min(1)
            .describe("Your bot id: pm_bot | client_manager | ci_builder | agency_bot | …"),
          outcome: overrideOutcomeZ.describe(
            "accept | edit | replace | regenerate | block | cosmetic | augment — accept is required when unchanged"
          ),
          override_trigger: overrideTriggerZ
            .nullable()
            .optional()
            .describe(
              "Required for edit|replace|regenerate|block: factually_wrong | wrong_tone | missing_context | policy | preference"
            ),
          surface: overrideSurfaceZ
            .optional()
            .describe("chat | task | email | guideline | ci_builder | report | content | sow | bd | hr | other"),
          task_id: z.string().uuid().nullable().optional(),
          project_id: z.string().uuid().nullable().optional(),
          dam_quadrant: damQuadrantZ.nullable().optional(),
          dam_alpha: z.union([z.literal(0), z.literal(0.5), z.literal(1)]).nullable().optional(),
          proposed_summary: z.string().nullable().optional(),
          final_summary: z.string().nullable().optional(),
          latency_s: z.number().nullable().optional(),
          reviewed_by_label: z
            .string()
            .nullable()
            .optional()
            .describe("Who reviewed: Ali | Thomas | …"),
          occurred_at: z
            .string()
            .nullable()
            .optional()
            .describe(
              "ISO timestamp when the review happened, if logging later the same week. Defaults to now."
            ),
          meta: z.record(z.string(), z.unknown()).nullable().optional(),
        }),
      },
      async (args) => toolLogOverride(args)
    );

    server.registerTool(
      "list_people",
      {
        title: "List people",
        description:
          "List active HR roster people who can be task assignees (ids = assignee_person_id). Includes bots (kind=bot).",
        inputSchema: z.object({}),
      },
      async () => toolListPeople()
    );

    server.registerTool(
      "create_person",
      {
        title: "Create person",
        description:
          "Create an HR roster person (human or bot). Bots get an @bots.wide email if none provided and are assignable by default.",
        inputSchema: z.object({
          name: z.string().min(1),
          kind: z.enum(["human", "bot"]).optional(),
          email: z.string().nullable().optional(),
          assignable_to_tasks: z.boolean().optional(),
        }),
      },
      async (args) => toolCreatePerson(args)
    );

    server.registerTool(
      "assign_task",
      {
        title: "Assign task",
        description:
          "Set or clear pm_tasks.assignee_person_id (HR people.id). Pass null to unassign.",
        inputSchema: z.object({
          task_id: z.string().uuid(),
          assignee_person_id: z.string().uuid().nullable(),
        }),
      },
      async (args) => toolAssignTask(args)
    );

    server.registerTool(
      "list_debug_items",
      {
        title: "List debug items",
        description: "List Debug center items (bugs and enhancements).",
        inputSchema: z.object({
          type: z.enum(["bug", "enhancement"]).optional(),
          status: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }),
      },
      async (args) => toolListDebugItems(args)
    );

    server.registerTool(
      "create_debug_item",
      {
        title: "Create debug item",
        description:
          "Create a bug or enhancement in the Debug center (/app/debug-center).",
        inputSchema: z.object({
          type: z.enum(["bug", "enhancement"]),
          title: z.string().min(1),
          body: z.string().min(1),
          project_id: z.string().uuid().nullable().optional(),
        }),
      },
      async (args) => toolCreateDebugItem(args)
    );

    server.registerTool(
      "update_debug_item",
      {
        title: "Update debug item",
        description:
          "Update Debug center status: open|in_progress|resolved|hidden.",
        inputSchema: z.object({
          id: z.string().uuid(),
          status: z.enum(["open", "in_progress", "resolved", "hidden"]),
          resolution_note: z.string().nullable().optional(),
        }),
      },
      async (args) => toolUpdateDebugItem(args)
    );

    server.registerTool(
      "get_project_finance",
      {
        title: "Get project finance",
        description:
          "Project deal/cost summary. monthly_fee and revenue map to deal_value; cost maps to estimated_cost; currency is EUR.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
        }),
      },
      async ({ project_id }) => toolGetProjectFinance(project_id)
    );

    server.registerTool(
      "update_project_finance",
      {
        title: "Update project finance",
        description:
          "Update deal/cost fields. monthly_fee sets deal_value + monthly frequency; revenue sets deal_value; cost sets estimated_cost. Currency must be EUR.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          monthly_fee: z.number().nullable().optional(),
          currency: z.string().nullable().optional(),
          cost: z.number().nullable().optional(),
          revenue: z.number().nullable().optional(),
        }),
      },
      async (args) => toolUpdateProjectFinance(args)
    );

    server.registerTool(
      "get_settings",
      {
        title: "Get settings",
        description: "Get GLOBAL task retitle policy from app_settings.",
        inputSchema: z.object({}),
      },
      async () => toolGetSettings()
    );

    server.registerTool(
      "update_settings",
      {
        title: "Update settings",
        description: "Update GLOBAL task retitle policy (not secrets).",
        inputSchema: z.object({
          retitle_mode: z.enum(["locked", "default", "free"]).optional(),
          max_retitles: z.number().int().min(0).max(20).optional(),
          allow_polish: z.boolean().optional(),
          rule: z.string().optional(),
        }),
      },
      async (args) => toolUpdateSettings(args)
    );

    server.registerTool(
      "list_content_calendars",
      {
        title: "List content calendars",
        description:
          "List content calendar months for a project (period_start + status).",
        inputSchema: z.object({
          project_id: z.string().uuid(),
        }),
      },
      async ({ project_id }) => toolListContentCalendars(project_id)
    );

    server.registerTool(
      "get_content_month",
      {
        title: "Get content month",
        description:
          "Load one content calendar month and posts. Default compact=true (id, post_number, scheduled_date, statuses, platforms, media_kind). Set compact=false for full captions/brief/media. Use get_content_post(post_id) for production detail.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          period_start: z.string().optional().describe("YYYY-MM-01 or YYYY-MM"),
          calendar_id: z.string().uuid().optional(),
          compact: z.boolean().optional().describe("Default true. Set false for full post payloads."),
        }),
      },
      async (args) => toolGetContentMonth(args)
    );

    server.registerTool(
      "get_content_post",
      {
        title: "Get content post",
        description:
          "Full content_posts row: captions, media[], media_kind, visual_asset_url, published_links, visual_brief, visual_format_spec, story_repost, remarks, statuses.",
        inputSchema: z.object({
          post_id: z.string().uuid(),
        }),
      },
      async ({ post_id }) => toolGetContentPost(post_id)
    );

    server.registerTool(
      "update_content_post",
      {
        title: "Update content post",
        description:
          `Write captions, visuals, brief, statuses. ${CONTENT_MEDIA_MCP_DOC} ${VISUAL_BRIEF_MCP_DOC} ${CONTENT_POST_LIVE_NOTE}`,
        inputSchema: z.object({
          post_id: z.string().uuid(),
          hook_angle: z.string().nullable().optional(),
          pillar: z.string().nullable().optional(),
          captions: z.record(z.string(), z.record(z.string(), z.string())).nullable().optional(),
          visual_brief: z.record(z.string(), z.string()).nullable().optional(),
          visual_asset_url: z.string().nullable().optional(),
          visual_format: z.enum(["feed", "reel", "story"]).nullable().optional(),
          media_kind: z.enum(["image", "carousel", "video"]).nullable().optional(),
          media: z
            .array(
              z.object({
                id: z.string().optional(),
                url: z.string(),
                kind: z.enum(["image", "video"]).optional(),
                poster_url: z.string().optional(),
                source: z.string().optional(),
              })
            )
            .nullable()
            .optional(),
          image_urls: z
            .array(z.string())
            .nullable()
            .optional()
            .describe("HTTPS image URLs → shared media slides (WIP posts)"),
          media_by_platform: z
            .object({
              instagram: z
                .array(
                  z.object({
                    id: z.string().optional(),
                    url: z.string(),
                    kind: z.enum(["image", "video"]).optional(),
                    poster_url: z.string().optional(),
                    source: z.string().optional(),
                  })
                )
                .optional(),
              linkedin: z
                .array(
                  z.object({
                    id: z.string().optional(),
                    url: z.string(),
                    kind: z.enum(["image", "video"]).optional(),
                    poster_url: z.string().optional(),
                    source: z.string().optional(),
                  })
                )
                .optional(),
            })
            .nullable()
            .optional(),
          published_permalink: z.string().nullable().optional(),
          published_links: z
            .object({
              instagram: z.string().optional(),
              linkedin: z.string().optional(),
            })
            .nullable()
            .optional(),
          story_repost: z
            .object({
              strategy_text: z.string(),
              sticker_type: z.string(),
              link_url: z.string().optional(),
              link_label: z.string().optional(),
              stickers: z.array(z.string()).optional(),
              cta_hint: z.string().optional(),
              music_hint: z.string().nullable().optional(),
              frame_notes: z.string().optional(),
            })
            .nullable()
            .optional(),
          linked_post_id: z.string().uuid().nullable().optional(),
          remarks: z.string().nullable().optional(),
          platforms: z.array(z.string()).nullable().optional(),
          is_video: z.boolean().nullable().optional(),
          status_approval: z.string().nullable().optional(),
          status_production: z.string().nullable().optional(),
          ad_status: z.string().nullable().optional(),
          angle_approved: z.boolean().nullable().optional(),
          scheduled_date: z.string().nullable().optional(),
          post_number: z.number().int().positive().nullable().optional(),
        }),
      },
      async (args) => toolUpdateContentPost(args)
    );

    server.registerTool(
      "create_content_post",
      {
        title: "Create content post",
        description:
          `Insert a content_posts row. Provide calendar_id, or project_id + period_start (or scheduled_date). Optional post_number for leftovers (e.g. 43 for #043-V2). Defaults: status_approval=draft, status_production=wip. ${CONTENT_MEDIA_MCP_DOC} ${VISUAL_BRIEF_MCP_DOC} ${CONTENT_POST_LIVE_NOTE}`,
        inputSchema: z.object({
          calendar_id: z.string().uuid().optional(),
          project_id: z.string().uuid().optional(),
          period_start: z.string().optional(),
          scheduled_date: z.string().nullable().optional(),
          hook_angle: z.string().nullable().optional(),
          pillar: z.string().nullable().optional(),
          platforms: z.array(z.string()).nullable().optional(),
          status_approval: z.string().nullable().optional(),
          status_production: z.string().nullable().optional(),
          ad_status: z.string().nullable().optional(),
          visual_format: z.enum(["feed", "reel", "story"]).nullable().optional(),
          media_kind: z.enum(["image", "carousel", "video"]).nullable().optional(),
          media: z
            .array(
              z.object({
                id: z.string().optional(),
                url: z.string(),
                kind: z.enum(["image", "video"]).optional(),
                poster_url: z.string().optional(),
                source: z.string().optional(),
              })
            )
            .nullable()
            .optional(),
          image_urls: z.array(z.string()).nullable().optional(),
          media_by_platform: z
            .object({
              instagram: z
                .array(
                  z.object({
                    id: z.string().optional(),
                    url: z.string(),
                    kind: z.enum(["image", "video"]).optional(),
                    poster_url: z.string().optional(),
                    source: z.string().optional(),
                  })
                )
                .optional(),
              linkedin: z
                .array(
                  z.object({
                    id: z.string().optional(),
                    url: z.string(),
                    kind: z.enum(["image", "video"]).optional(),
                    poster_url: z.string().optional(),
                    source: z.string().optional(),
                  })
                )
                .optional(),
            })
            .nullable()
            .optional(),
          is_video: z.boolean().nullable().optional(),
          captions: z.record(z.string(), z.record(z.string(), z.string())).nullable().optional(),
          visual_brief: z.record(z.string(), z.string()).nullable().optional(),
          visual_asset_url: z.string().nullable().optional(),
          published_permalink: z.string().nullable().optional(),
          published_links: z
            .object({
              instagram: z.string().optional(),
              linkedin: z.string().optional(),
            })
            .nullable()
            .optional(),
          remarks: z.string().nullable().optional(),
          angle_approved: z.boolean().nullable().optional(),
          post_number: z.number().int().positive().nullable().optional(),
        }),
      },
      async (args) => toolCreateContentPost(args)
    );

    server.registerTool(
      "generate_content_month",
      {
        title: "Generate content month",
        description:
          `Plan or write a content calendar month. step=angles creates post rows; approve angles then step=full writes captions/briefs. Also post_angle/post_full for one post. ${CONTENT_CALENDAR_MCP_PLAYBOOK}`,
        inputSchema: z.object({
          project_id: z.string().uuid(),
          step: z.enum(["angles", "full", "post_angle", "post_full"]),
          period_start: z.string().optional().describe("YYYY-MM-01 or YYYY-MM"),
          theme_notes: z.string().nullable().optional(),
          post_id: z.string().uuid().optional(),
          replace: z.boolean().optional().describe("angles only — delete unlocked posts first"),
          regenerate_drafts: z
            .boolean()
            .optional()
            .describe("full only — rewrite posts already in draft/review"),
        }),
      },
      async (args) => toolGenerateContentMonth(args)
    );

    server.registerTool(
      "ingest_content_media_from_url",
      {
        title: "Ingest content media from URL",
        description:
          `Fetch a public https image/video URL server-side, store on content-media, attach to post. Prefer over base64 for large files. ${CONTENT_MEDIA_MCP_DOC} ${CONTENT_CALENDAR_MCP_PLAYBOOK}`,
        inputSchema: z.object({
          post_id: z.string().uuid(),
          url: z.string().describe("Public https:// image or video URL"),
          filename: z.string().nullable().optional(),
          platform: z.enum(["shared", "instagram", "linkedin"]).optional(),
          attach: z.boolean().optional().describe("Default true"),
        }),
      },
      async (args) => toolIngestContentMediaFromUrl(args)
    );

    server.registerTool(
      "approve_all_content_angles",
      {
        title: "Approve all content angles",
        description:
          `Set angle_approved=true on all unlocked posts in a calendar month (before generate_content_month step=full). ${CONTENT_CALENDAR_MCP_PLAYBOOK}`,
        inputSchema: z.object({
          calendar_id: z.string().uuid().optional(),
          project_id: z.string().uuid().optional(),
          period_start: z.string().optional(),
        }),
      },
      async (args) => toolApproveAllContentAngles(args)
    );

    server.registerTool(
      "approve_all_content_posts",
      {
        title: "Approve all content posts",
        description:
          `Lock all reviewable posts as approved and set calendar status=approved (client portal final sign-off). ${CONTENT_CALENDAR_MCP_PLAYBOOK}`,
        inputSchema: z.object({
          calendar_id: z.string().uuid().optional(),
          project_id: z.string().uuid().optional(),
          period_start: z.string().optional(),
        }),
      },
      async (args) => toolApproveAllContentPosts(args)
    );

    server.registerTool(
      "upload_content_post_media",
      {
        title: "Upload content post media",
        description:
          `Upload image/video bytes to Supabase content-media and attach to a WIP post. Required when the bot only has a local file — do NOT pass file:// paths to update_content_post. ${CONTENT_MEDIA_MCP_DOC} ${CONTENT_CALENDAR_MCP_PLAYBOOK}`,
        inputSchema: z.object({
          post_id: z.string().uuid(),
          filename: z.string().describe("e.g. slide-1.jpg"),
          content_base64: z.string().describe("Raw file bytes, base64-encoded"),
          mime_type: z.string().nullable().optional(),
          platform: z.enum(["shared", "instagram", "linkedin"]).optional(),
          attach: z
            .boolean()
            .optional()
            .describe("Default true — append slide to post media"),
        }),
      },
      async (args) => toolUploadContentPostMedia(args)
    );

    server.registerTool(
      "delete_content_post",
      {
        title: "Delete content post",
        description:
          "Permanently delete a content_posts row (and its comments). No lock check — use to remove stale calendar rows before rewriting a month.",
        inputSchema: z.object({
          post_id: z.string().uuid(),
        }),
      },
      async ({ post_id }) => toolDeleteContentPost(post_id)
    );

    server.registerTool(
      "update_content_calendar",
      {
        title: "Update content calendar",
        description:
          "Set content_calendars status (draft|in_review|approved) and/or theme_notes. When status is in_review or approved, unlocks draft/on_hold posts to needs_review (same as Share with client) unless unlock_drafts=false.",
        inputSchema: z.object({
          calendar_id: z.string().uuid().optional(),
          project_id: z.string().uuid().optional(),
          period_start: z.string().optional(),
          status: z.enum(["draft", "in_review", "approved"]).optional(),
          theme_notes: z.string().nullable().optional(),
          unlock_drafts: z.boolean().optional(),
        }),
      },
      async (args) => toolUpdateContentCalendar(args)
    );

    server.registerTool(
      "list_blog_articles",
      {
        title: "List blog articles",
        description:
          "List blog_articles for a project. Includes recommended cover format 16:9 1600×900.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          limit: z.number().int().min(1).max(200).optional(),
        }),
      },
      async (args) => toolListBlogArticles(args)
    );

    server.registerTool(
      "get_blog_article",
      {
        title: "Get blog article",
        description: "Full blog_articles row plus cover visual_format_spec (16:9).",
        inputSchema: z.object({
          article_id: z.string().uuid(),
        }),
      },
      async ({ article_id }) => toolGetBlogArticle(article_id)
    );

    server.registerTool(
      "upsert_blog_article",
      {
        title: "Upsert blog article",
        description:
          "Create or update blog_articles (OS store, not Webflow). Pass id to update. Fields: title, slug, status, scheduled_for, published_url, client_visible, language, meta_description, body_md.",
        inputSchema: z.object({
          id: z.string().uuid().optional(),
          project_id: z.string().uuid(),
          title: z.string().optional(),
          slug: z.string().nullable().optional(),
          status: z.string().optional(),
          scheduled_for: z.string().nullable().optional(),
          published_url: z.string().nullable().optional(),
          client_visible: z.boolean().optional(),
          language: z.string().nullable().optional(),
          meta_description: z.string().nullable().optional(),
          body_md: z.string().nullable().optional(),
        }),
      },
      async (args) => toolUpsertBlogArticle(args)
    );

    server.registerTool(
      "list_published_reports",
      {
        title: "List published reports",
        description:
          "List published_reports rows for a project (category + draft/published status).",
        inputSchema: z.object({
          project_id: z.string().uuid(),
        }),
      },
      async ({ project_id }) => toolListPublishedReports(project_id)
    );

    server.registerTool(
      "get_published_report",
      {
        title: "Get published report",
        description: "Full published_reports row including config JSON.",
        inputSchema: z.object({
          id: z.string().uuid(),
        }),
      },
      async ({ id }) => toolGetPublishedReport(id)
    );

    server.registerTool(
      "upsert_published_report",
      {
        title: "Upsert published report",
        description:
          "Upsert published_reports on (project_id, category). Categories: General|Social|Ads|Website|SEO. status draft|published. Does not sync Meta/GA datasets.",
        inputSchema: z.object({
          project_id: z.string().uuid(),
          category: z.string(),
          status: z.enum(["draft", "published"]),
          config: z.record(z.string(), z.unknown()).nullable().optional(),
        }),
      },
      async (args) => toolUpsertPublishedReport(args)
    );

    server.registerTool(
      "list_guidelines",
      {
        title: "List brand guidelines",
        description: "List ci_guidelines for a project (slug + publish status).",
        inputSchema: z.object({
          project_id: z.string().uuid(),
        }),
      },
      async ({ project_id }) => toolListGuidelines(project_id)
    );

    server.registerTool(
      "get_guideline",
      {
        title: "Get brand guideline",
        description: "ci_guidelines row (no sections). Use CI Builder UI for section editing.",
        inputSchema: z.object({
          id: z.string().uuid(),
        }),
      },
      async ({ id }) => toolGetGuideline(id)
    );

    server.registerTool(
      "update_guideline",
      {
        title: "Update brand guideline",
        description:
          "Set ci_guidelines status (draft|published), slug, and/or theme. Sections stay in CI Builder.",
        inputSchema: z.object({
          id: z.string().uuid(),
          status: z.enum(["draft", "published"]).optional(),
          slug: z.string().nullable().optional(),
          theme: z.record(z.string(), z.unknown()).nullable().optional(),
        }),
      },
      async (args) => toolUpdateGuideline(args)
    );

    server.registerTool(
      "list_seo_sites",
      {
        title: "List SEO sites",
        description: "List seo_sites by project_id or company_id (client SEO tab gate).",
        inputSchema: z.object({
          project_id: z.string().uuid().optional(),
          company_id: z.string().uuid().optional(),
        }),
      },
      async (args) => toolListSeoSites(args)
    );

    server.registerTool(
      "update_seo_site",
      {
        title: "Update SEO site",
        description: "Update seo_sites is_client_visible, label, domain, or url.",
        inputSchema: z.object({
          id: z.string().uuid(),
          is_client_visible: z.boolean().optional(),
          label: z.string().nullable().optional(),
          domain: z.string().optional(),
          url: z.string().optional(),
        }),
      },
      async (args) => toolUpdateSeoSite(args)
    );

    server.registerTool(
      "get_seo_run",
      {
        title: "Get SEO run",
        description:
          "Latest ready seo_runs for a site, or a specific run_id. Read-only scores/summary.",
        inputSchema: z.object({
          site_id: z.string().uuid(),
          run_id: z.string().uuid().optional(),
        }),
      },
      async (args) => toolGetSeoRun(args)
    );

    server.registerTool(
      "list_sows",
      {
        title: "List SOWs",
        description: "List sows by project_id or company_id.",
        inputSchema: z.object({
          project_id: z.string().uuid().optional(),
          company_id: z.string().uuid().optional(),
        }),
      },
      async (args) => toolListSows(args)
    );

    server.registerTool(
      "get_sow",
      {
        title: "Get SOW",
        description:
          "Full SOW document: meta, sections, line items, cost groups, portfolio slides.",
        inputSchema: z.object({
          id: z.string().uuid(),
        }),
      },
      async ({ id }) => toolGetSow(id)
    );

    server.registerTool(
      "create_sow",
      {
        title: "Create SOW",
        description:
          "Create a draft SOW for a CRM company. Seeds sections from package_id or service_ids. Never auto-publishes.",
        inputSchema: z.object({
          company_id: z.string().uuid(),
          title: z.string().optional(),
          project_id: z.string().uuid().optional(),
          package_id: z.string().uuid().optional(),
          service_ids: z.array(z.string().uuid()).optional(),
          context_text: z.string().optional(),
          version_of_id: z.string().uuid().optional(),
        }),
      },
      async (args) => toolCreateSow(args)
    );

    server.registerTool(
      "upsert_sow_line_item",
      {
        title: "Update SOW line item",
        description:
          "Patch price, quantity, title, description, cadence, or sort_order on an existing sow_line_items row.",
        inputSchema: z.object({
          id: z.string().uuid(),
          title: z.string().optional(),
          description: z.string().nullable().optional(),
          price: z.number().nullable().optional(),
          quantity_label: z.string().nullable().optional(),
          cadence: z.string().nullable().optional(),
          is_recurring: z.boolean().optional(),
          sort_order: z.number().optional(),
        }),
      },
      async (args) => toolUpsertSowLineItem(args)
    );

    server.registerTool(
      "update_sow",
      {
        title: "Update SOW",
        description: "Set sows status (draft|published|accepted|archived) and/or title.",
        inputSchema: z.object({
          id: z.string().uuid(),
          status: z.enum(["draft", "published", "accepted", "archived"]).optional(),
          title: z.string().optional(),
        }),
      },
      async (args) => toolUpdateSow(args)
    );
  },
  {
    serverInfo: {
      name: "wide-os",
      version: "1.8.1",
    },
  }
);

async function handle(req: Request): Promise<Response> {
  if (!authorizeMcpRequest(req)) return mcpUnauthorizedResponse();
  return mcpHandler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
