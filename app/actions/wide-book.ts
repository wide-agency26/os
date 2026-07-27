"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function createBrandBook(formData: FormData) {
  const client_id = formData.get("client_id") as string;
  const project_title = formData.get("project_title") as string;
  const client_slug = formData.get("client_slug") as string;
  const figma_file_url = formData.get("figma_file_url") as string;
  const figma_access_token = formData.get("figma_access_token") as string;
  const portal_password = formData.get("portal_password") as string;

  if (!client_id || !project_title || !client_slug || !portal_password) {
    return { error: "Missing required fields." };
  }

  const supabase = (await createClient()) as any;

  const { error } = await supabase.from("brand_books").insert({
    client_id,
    project_title,
    client_slug,
    figma_file_url,
    figma_access_token,
    portal_password,
    canvas_blocks: []
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/wide-book");
  return { success: true };
}

export async function updateCanvasBlocks(id: string, canvas_blocks: any[]) {
  const supabase = (await createClient()) as any;

  const { error } = await supabase
    .from("brand_books")
    .update({ canvas_blocks })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/wide-book");
  return { success: true };
}

export async function ingestFromFigma(bookId: string) {
  const supabase = (await createClient()) as any;

  const { data: book, error: fetchError } = await supabase
    .from("brand_books")
    .select("*")
    .eq("id", bookId)
    .single();

  if (fetchError || !book) {
    return { error: "Failed to load brand book." };
  }

  // Mocking the ingestion of 11 explicit system sections as requested in the development order
  const mockBlocks = [
    {
      id: "block_01",
      type: "overview",
      is_visible: true,
      payload: {
        brand_name: book.project_title || "ACME Corp",
        mission: "To revolutionize the digital space with minimal friction.",
        vision: "A future where every pixel serves a purpose.",
        manifesto: "We believe in bold moves and structural typography.",
        problem_solution: "Problem: Clutter.\nSolution: WIDE OS.",
        value_definition: "Unmatched performance through structural clarity.",
        target_group: "Digital pioneers and visionary founders."
      }
    },
    {
      id: "block_02",
      type: "logo",
      is_visible: true,
      payload: {
        primary_dark: "https://via.placeholder.com/400x150.png?text=Logo+Dark",
        primary_light: "https://via.placeholder.com/400x150.png?text=Logo+Light",
        mark_icon: "https://via.placeholder.com/150x150.png?text=Mark",
        monochrome: "https://via.placeholder.com/400x150.png?text=Monochrome",
        clearspace_rules: "Schutzraum = ¼ Logo-Höhe"
      }
    },
    {
      id: "block_03",
      type: "farben",
      is_visible: true,
      payload: {
        colors: [
          { label: "Neon Accent", hex: "#00FF00" },
          { label: "Deep Zinc", hex: "#09090b" },
          { label: "Muted Zinc", hex: "#27272a" },
          { label: "White", hex: "#FFFFFF" }
        ]
      }
    },
    {
      id: "block_04",
      type: "typografie",
      is_visible: true,
      payload: {
        fonts: [
          { label: "Display", fontFamily: "Inter", fontWeight: 900, size: "8rem", tracking: "-0.05em" },
          { label: "Body", fontFamily: "Inter", fontWeight: 400, size: "1rem", tracking: "normal" },
          { label: "Mono", fontFamily: "IBM Plex Mono", fontWeight: 500, size: "0.875rem", tracking: "normal" }
        ]
      }
    },
    {
      id: "block_05",
      type: "buttons",
      is_visible: true,
      payload: {
        styles: [
          { label: "Primary CTA", css: "bg-[#00FF00] text-black border-none rounded-full" },
          { label: "Secondary", css: "bg-transparent text-white border border-zinc-800 rounded-full" },
          { label: "Ghost", css: "bg-transparent text-zinc-400 hover:text-white rounded-full" }
        ]
      }
    },
    {
      id: "block_06",
      type: "raster_frames",
      is_visible: true,
      payload: {
        frames: [
          { label: "1:1 Social Square", url: "https://via.placeholder.com/400x400.png?text=Square" },
          { label: "9:16 Story Reels", url: "https://via.placeholder.com/400x711.png?text=Story" },
          { label: "4:5 Feed", url: "https://via.placeholder.com/400x500.png?text=Feed" },
          { label: "12-Column Grid", url: "https://via.placeholder.com/800x400.png?text=Grid" }
        ]
      }
    },
    {
      id: "block_07",
      type: "hintergrunde",
      is_visible: true,
      payload: {
        backgrounds: [
          { url: "https://via.placeholder.com/800x600.png?text=Dark+Texture" },
          { url: "https://via.placeholder.com/800x600.png?text=SVG+Rings" }
        ]
      }
    },
    {
      id: "block_08",
      type: "bildsprache",
      is_visible: true,
      payload: {
        rules: ["Tiefen halten Tiefen", "Kein Stock-Optimismus", "Authentic framing"]
      }
    },
    {
      id: "block_09",
      type: "sprache_tonalitat",
      is_visible: true,
      payload: {
        slogans: ["MOVE FAST. BREAK NOTHING.", "BUILD FOR TOMORROW."],
        do_list: ["Direct sentences", "Active voice", "Technical terms"],
        dont_list: ["Fluff", "Passive voice", "Corporate jargon"]
      }
    },
    {
      id: "block_10",
      type: "anwendungen",
      is_visible: true,
      payload: {
        mockups: [
          { label: "E-Ticket Layout", url: "https://via.placeholder.com/600x400.png?text=Ticket" },
          { label: "Social Frame", url: "https://via.placeholder.com/400x400.png?text=Social" }
        ]
      }
    },
    {
      id: "block_11",
      type: "dos_donts",
      is_visible: true,
      payload: {
        examples: [
          { label: "Use high contrast", image: "https://via.placeholder.com/300x200.png?text=DO", status: "DO" },
          { label: "Don't use low contrast", image: "https://via.placeholder.com/300x200.png?text=DONT", status: "DONT" }
        ]
      }
    }
  ];

  try {
    // Update DB with the mocked blocks
    const { error: updateError } = await supabase.from("brand_books").update({
      canvas_blocks: mockBlocks,
      updated_at: new Date().toISOString()
    }).eq("id", bookId);

    if (updateError) throw updateError;

    revalidatePath("/admin/wide-book");
    return { success: true };

  } catch (err: any) {
    return { error: err.message || "Failed to generate layout blocks." };
  }
}

