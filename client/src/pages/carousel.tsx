import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, Download, Image, Check, ArrowLeft, MoreHorizontal, Upload, Share2, Bookmark, ChevronLeft } from "lucide-react";
import type { LlmSetting } from "@shared/schema";
import { HelpButton } from "@/components/help-button";
import { toPng } from "html-to-image";
import JSZip from "jszip";

type CarouselDesign = "notes" | "journal" | "minimal_dark" | "influencer";

interface CarouselPage {
  title: string;
  intro_paragraph: string;
  points: string[];
  blockquote_text: string;
}

interface CarouselContent {
  first_page_title: string;
  content_pages: CarouselPage[];
  call_to_action_page: {
    title: string;
    description: string;
  };
}

type Slide =
  | { type: "first"; title: string }
  | ({ type: "content" } & CarouselPage)
  | { type: "cta"; title: string; description: string };

function EditableText({
  value,
  onChange,
  className,
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
      rows={1}
      className={`bg-transparent border-none outline-none resize-none overflow-hidden w-full p-0 m-0 focus:ring-1 focus:ring-dashed focus:ring-gray-400/50 rounded-sm ${className || ""}`}
      style={{ ...style, fontFamily: "inherit" }}
      data-testid="textarea-slide-edit"
    />
  );
}

function NotesSlide({
  slide,
  slideIndex,
  totalSlides,
  onUpdate,
}: {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (field: string, value: string | string[]) => void;
}) {
  return (
    <div className="w-[375px] h-[469px] overflow-hidden relative flex flex-col" style={{ backgroundColor: "#FBFBF8", color: "#2D2D2D", fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between p-5 shrink-0" style={{ color: "#D97706" }}>
        <div className="flex items-center text-sm font-medium">
          <ChevronLeft className="w-4 h-4" />
          <span className="ml-1">{"3аметки"}</span>
        </div>
        <div className="flex gap-4">
          <Upload className="w-4 h-4" />
          <MoreHorizontal className="w-4 h-4" />
        </div>
      </div>
      <div className="px-8 pt-2 pb-8 flex-1 flex flex-col overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
        {slide.type === "first" ? (
          <div className="flex flex-col h-full justify-start pt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>
              {"Сегодня, " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("title", val)}
              className="text-2xl font-extrabold leading-tight tracking-tight mb-6"
              style={{ color: "#2D2D2D" }}
            />
            <div className="w-12 h-1 rounded-full mb-6" style={{ backgroundColor: "rgba(217, 119, 6, 0.3)" }} />
          </div>
        ) : slide.type === "cta" ? (
          <div className="flex flex-col h-full justify-center items-center text-center">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("ctaTitle", val)}
              className="text-2xl font-bold mb-3 text-center"
              style={{ color: "#2D2D2D" }}
            />
            <EditableText
              value={slide.description}
              onChange={(val) => onUpdate("ctaDescription", val)}
              className="text-sm leading-relaxed text-center max-w-[260px]"
              style={{ color: "#6B7280" }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("title", val)}
              className="text-lg font-bold mb-4 leading-tight shrink-0"
              style={{ color: "#2D2D2D" }}
            />
            {slide.intro_paragraph && (
              <EditableText
                value={slide.intro_paragraph}
                onChange={(val) => onUpdate("intro_paragraph", val)}
                className="text-sm leading-normal mb-5 shrink-0"
                style={{ color: "#4B5563" }}
              />
            )}
            <div className="flex-grow flex flex-col gap-3 overflow-y-auto">
              {slide.points?.map((point, i) => (
                <div key={i} className="flex items-start text-sm" style={{ color: "#2D2D2D" }}>
                  <span className="mr-2.5 mt-1 shrink-0" style={{ color: "#D97706" }}>
                    {"\u2022"}
                  </span>
                  <EditableText
                    value={point}
                    onChange={(val) => {
                      const newPoints = [...(slide.points || [])];
                      newPoints[i] = val;
                      onUpdate("points", newPoints);
                    }}
                  />
                </div>
              ))}
            </div>
            {slide.blockquote_text && (
              <div className="shrink-0 mt-auto pt-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A" }}>
                  <EditableText
                    value={slide.blockquote_text}
                    onChange={(val) => onUpdate("blockquote_text", val)}
                    className="text-xs italic text-center"
                    style={{ color: "#4B5563" }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function JournalSlide({
  slide,
  slideIndex,
  totalSlides,
  onUpdate,
}: {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (field: string, value: string | string[]) => void;
}) {
  return (
    <div className="w-[375px] h-[469px] overflow-hidden relative flex flex-col" style={{ backgroundColor: "#FFFFFF", color: "#1c1c1e", fontFamily: "Inter, sans-serif" }}>
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-1" style={{ color: "#E0B038" }}>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[17px] font-normal leading-none">{"Назад"}</span>
        </div>
        <div className="flex items-center gap-4" style={{ color: "#E0B038" }}>
          <Upload className="w-4 h-4" />
          <MoreHorizontal className="w-4 h-4" />
        </div>
      </div>
      <div className="px-6 pb-6 flex-1 flex flex-col overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
        {slide.type === "first" ? (
          <div className="flex flex-col h-full justify-start pt-4">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("title", val)}
              className="text-[24px] font-bold leading-[1.2] tracking-tight mb-4"
              style={{ color: "#1c1c1e" }}
            />
            <div className="w-full h-px mb-6" style={{ backgroundColor: "#E5E7EB" }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
              {"Пролистай вправо \u2192"}
            </span>
          </div>
        ) : slide.type === "cta" ? (
          <div className="flex flex-col h-full justify-center items-center text-center">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("ctaTitle", val)}
              className="text-[26px] font-bold mb-6 text-center leading-tight"
              style={{ color: "#DC2626" }}
            />
            <div className="w-16 h-1 rounded-full mb-8" style={{ backgroundColor: "#E5E7EB" }} />
            <EditableText
              value={slide.description}
              onChange={(val) => onUpdate("ctaDescription", val)}
              className="text-lg leading-relaxed text-center max-w-[320px]"
              style={{ color: "#374151" }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="shrink-0 mb-3">
              <EditableText
                value={slide.title}
                onChange={(val) => onUpdate("title", val)}
                className="text-[20px] font-bold leading-[1.2] mb-2"
                style={{ color: "#1c1c1e" }}
              />
              {slide.intro_paragraph && (
                <EditableText
                  value={slide.intro_paragraph}
                  onChange={(val) => onUpdate("intro_paragraph", val)}
                  className="text-[14px] leading-normal"
                  style={{ color: "#374151" }}
                />
              )}
            </div>
            <div className="flex-grow flex flex-col justify-start gap-3 mb-3 overflow-y-auto min-h-0">
              {slide.points?.map((point, i) => (
                <div key={i} className="flex items-start text-[13px] leading-snug" style={{ color: "#1c1c1e" }}>
                  <span className="mr-3 mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "#1c1c1e" }} />
                  <EditableText
                    value={point}
                    onChange={(val) => {
                      const newPoints = [...(slide.points || [])];
                      newPoints[i] = val;
                      onUpdate("points", newPoints);
                    }}
                  />
                </div>
              ))}
            </div>
            {slide.blockquote_text && (
              <div className="shrink-0 mt-auto py-2" style={{ borderLeft: "3px solid #C5C5C7", paddingLeft: "1rem" }}>
                <div className="text-[13px] leading-snug font-medium" style={{ color: "#4B5563" }}>
                  <EditableText
                    value={slide.blockquote_text}
                    onChange={(val) => onUpdate("blockquote_text", val)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MinimalDarkSlide({
  slide,
  slideIndex,
  totalSlides,
  onUpdate,
}: {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (field: string, value: string | string[]) => void;
}) {
  return (
    <div className="w-[375px] h-[469px] overflow-hidden relative flex flex-col" style={{ backgroundColor: "#000000", color: "#FFFFFF", fontFamily: "Inter, sans-serif", border: "1px solid #1F2937" }}>
      <div className="absolute top-5 right-5 text-xs font-bold z-20" style={{ color: "#D1D5DB" }}>
        {slideIndex + 1}/{totalSlides}
      </div>
      <div className="flex-1 flex flex-col p-6 overflow-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
        {slide.type === "first" ? (
          <div className="flex flex-col h-full justify-end pb-16">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("title", val)}
              className="text-[24px] font-bold leading-[1.1] tracking-tight mb-4"
              style={{ color: "#FFFFFF" }}
            />
          </div>
        ) : slide.type === "cta" ? (
          <div className="flex flex-col h-full pt-10">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("ctaTitle", val)}
              className="text-[24px] font-bold mb-6 leading-tight"
              style={{ color: "#FFFFFF" }}
            />
            <EditableText
              value={slide.description}
              onChange={(val) => onUpdate("ctaDescription", val)}
              className="text-[15px] leading-relaxed"
              style={{ color: "#D1D5DB" }}
            />
            <div className="mt-auto mb-14 p-5 rounded-lg" style={{ backgroundColor: "#1A1A1A", borderLeft: "2px solid #FFFFFF" }}>
              <p className="text-sm font-medium" style={{ color: "#D1D5DB" }}>{"@metamill"}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full pt-6 pb-14">
            <div className="shrink-0 mb-5">
              <EditableText
                value={slide.title}
                onChange={(val) => onUpdate("title", val)}
                className="text-[22px] font-bold leading-[1.2] mb-3"
                style={{ color: "#FFFFFF" }}
              />
              {slide.intro_paragraph && (
                <EditableText
                  value={slide.intro_paragraph}
                  onChange={(val) => onUpdate("intro_paragraph", val)}
                  className="text-[15px] leading-relaxed"
                  style={{ color: "#D1D5DB" }}
                />
              )}
            </div>
            <div className="flex-grow flex flex-col justify-start gap-4 mb-4 overflow-y-auto min-h-0">
              {slide.points?.map((point, i) => (
                <div key={i} className="flex flex-col text-[15px] leading-snug" style={{ color: "#FFFFFF" }}>
                  <EditableText
                    value={point}
                    onChange={(val) => {
                      const newPoints = [...(slide.points || [])];
                      newPoints[i] = val;
                      onUpdate("points", newPoints);
                    }}
                  />
                </div>
              ))}
            </div>
            {slide.blockquote_text && (
              <div className="shrink-0 mt-auto p-4 rounded-lg" style={{ backgroundColor: "#1A1A1A", borderLeft: "2px solid #FFFFFF" }}>
                <div className="text-[14px] leading-snug font-medium" style={{ color: "#FFFFFF" }}>
                  <EditableText
                    value={slide.blockquote_text}
                    onChange={(val) => onUpdate("blockquote_text", val)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[50px] flex items-center justify-between px-5 z-20" style={{ borderTop: "1px solid rgba(255,255,255,0.2)", backgroundColor: "#000000" }}>
        <div className="flex items-center gap-2" style={{ color: "#FFFFFF" }}>
          <Share2 className="w-4 h-4" />
          <span className="text-[11px] font-medium">{"Поделиться"}</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "#FFFFFF" }}>
          <span className="text-[11px] font-medium">{"Сохранить"}</span>
          <Bookmark className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function InfluencerSlide({
  slide,
  slideIndex,
  totalSlides,
  onUpdate,
}: {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (field: string, value: string | string[]) => void;
}) {
  return (
    <div className="w-[375px] h-[469px] overflow-hidden relative flex flex-col" style={{ backgroundColor: "#111111", color: "#FFFFFF", fontFamily: "Inter, sans-serif" }}>
      {!slide.type || slide.type !== "first" ? (
        <div className="px-6 pt-6" style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "inline-block" }}>
            <p className="text-[13px] font-medium tracking-wide mb-1" style={{ color: "#E5E7EB" }}>@metamill</p>
            <div style={{ width: "120%", height: "2px", backgroundColor: "rgba(255,255,255,0.9)" }} />
          </div>
        </div>
      ) : null}
      <div className="flex-1 px-6 flex flex-col overflow-hidden" style={{ position: "relative", zIndex: 10 }}>
        {slide.type === "first" ? (
          <div className="flex flex-col justify-end h-full pb-6">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("title", val)}
              className="text-[24px] font-extrabold leading-[1.05] uppercase tracking-tight text-left"
              style={{ color: "#FFFFFF" }}
            />
          </div>
        ) : slide.type === "cta" ? (
          <div className="flex flex-col h-full justify-center pt-6">
            <EditableText
              value={slide.title}
              onChange={(val) => onUpdate("ctaTitle", val)}
              className="text-[24px] font-bold uppercase leading-tight mb-5"
              style={{ color: "#FFFFFF" }}
            />
            <div className="p-4 backdrop-blur-sm" style={{ borderLeft: "2px solid #FFFFFF", backgroundColor: "rgba(255,255,255,0.05)" }}>
              <EditableText
                value={slide.description}
                onChange={(val) => onUpdate("ctaDescription", val)}
                className="text-[16px] italic leading-relaxed"
                style={{ color: "#E5E7EB" }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="shrink-0 mb-5">
              <EditableText
                value={slide.title}
                onChange={(val) => onUpdate("title", val)}
                className="text-[22px] font-bold leading-tight mb-3"
                style={{ color: "#FFFFFF" }}
              />
              {slide.intro_paragraph && (
                <EditableText
                  value={slide.intro_paragraph}
                  onChange={(val) => onUpdate("intro_paragraph", val)}
                  className="text-[16px] leading-snug font-normal"
                  style={{ color: "#E5E7EB" }}
                />
              )}
            </div>
            <div className="flex-grow flex flex-col justify-start gap-4 overflow-y-auto">
              {slide.points?.map((point, i) => (
                <div key={i} className="text-[16px] font-normal leading-snug" style={{ color: "#E5E7EB" }}>
                  <EditableText
                    value={point}
                    onChange={(val) => {
                      const newPoints = [...(slide.points || [])];
                      newPoints[i] = val;
                      onUpdate("points", newPoints);
                    }}
                  />
                </div>
              ))}
            </div>
            {slide.blockquote_text && (
              <div className="shrink-0 mt-auto pt-4">
                <div className="p-4 rounded-r-md" style={{ backgroundColor: "#1A1A1A", borderLeft: "4px solid #9CA3AF" }}>
                  <EditableText
                    value={slide.blockquote_text}
                    onChange={(val) => onUpdate("blockquote_text", val)}
                    className="text-[15px] font-medium leading-snug"
                    style={{ color: "#E5E7EB" }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ position: "relative", zIndex: 20 }} className="mt-auto">
        <div className="mx-6" style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.3)", marginBottom: "12px" }} />
        <div className="flex items-center justify-between px-6 pb-5" style={{ color: "#FFFFFF" }}>
          <div className="flex items-center gap-4">
            <Share2 className="w-4 h-4" style={{ transform: "rotate(-15deg)" }} />
            <span className="text-[10px] font-bold font-mono tracking-widest">
              {slideIndex + 1}/{totalSlides}
            </span>
          </div>
          <Bookmark className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function SlideRenderer({
  slide,
  design,
  slideIndex,
  totalSlides,
  onUpdate,
}: {
  slide: Slide;
  design: CarouselDesign;
  slideIndex: number;
  totalSlides: number;
  onUpdate: (field: string, value: string | string[]) => void;
}) {
  switch (design) {
    case "notes":
      return <NotesSlide slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} onUpdate={onUpdate} />;
    case "journal":
      return <JournalSlide slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} onUpdate={onUpdate} />;
    case "minimal_dark":
      return <MinimalDarkSlide slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} onUpdate={onUpdate} />;
    case "influencer":
      return <InfluencerSlide slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} onUpdate={onUpdate} />;
    default:
      return <NotesSlide slide={slide} slideIndex={slideIndex} totalSlides={totalSlides} onUpdate={onUpdate} />;
  }
}

const DESIGNS: { id: CarouselDesign; name: string; bgColor: string; textColor: string; borderColor: string }[] = [
  { id: "notes", name: "Apple Notes", bgColor: "#FBFBF8", textColor: "#2D2D2D", borderColor: "#D97706" },
  { id: "journal", name: "iOS Journal", bgColor: "#FFFFFF", textColor: "#1c1c1e", borderColor: "#E0B038" },
  { id: "minimal_dark", name: "Dark Editorial", bgColor: "#000000", textColor: "#FFFFFF", borderColor: "#374151" },
  { id: "influencer", name: "Personal Brand", bgColor: "#111111", textColor: "#FFFFFF", borderColor: "#4B5563" },
];

export default function Carousel() {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [ctaKeyword, setCtaKeyword] = useState("");
  const [numSlides, setNumSlides] = useState(5);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<CarouselDesign>("notes");
  const [carouselContent, setCarouselContent] = useState<CarouselContent | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { data: llmSettings } = useQuery<LlmSetting[]>({
    queryKey: ["/api/llm-settings"],
  });

  const activeSettings = llmSettings?.filter(s => s.isActive && s.provider !== "firecrawl" && s.provider !== "user_niche") || [];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        topic,
        numSlides,
        ctaKeyword,
      };
      if (selectedModel && selectedModel !== "default") {
        const setting = activeSettings.find((s) => `${s.provider}:${s.modelId}` === selectedModel);
        if (setting) {
          body.provider = setting.provider;
          body.modelId = setting.modelId;
        }
      }
      const res = await apiRequest("POST", "/api/generate-carousel", body);
      return await res.json();
    },
    onSuccess: (data: CarouselContent) => {
      setCarouselContent(data);
      toast({ title: "Карусель сгенерирована" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка генерации", description: error.message, variant: "destructive" });
    },
  });

  const slides: Slide[] = carouselContent
    ? [
        { type: "first", title: carouselContent.first_page_title },
        ...carouselContent.content_pages.map((page) => ({ type: "content" as const, ...page })),
        { type: "cta", ...carouselContent.call_to_action_page },
      ]
    : [];

  const handleUpdateContent = useCallback(
    (slideIndex: number, field: string, value: string | string[]) => {
      if (!carouselContent) return;
      const newContent = { ...carouselContent };

      if (slideIndex === 0) {
        if (field === "title") newContent.first_page_title = value as string;
      } else if (slideIndex === slides.length - 1) {
        if (field === "ctaTitle") newContent.call_to_action_page = { ...newContent.call_to_action_page, title: value as string };
        if (field === "ctaDescription") newContent.call_to_action_page = { ...newContent.call_to_action_page, description: value as string };
      } else {
        const contentIndex = slideIndex - 1;
        if (newContent.content_pages[contentIndex]) {
          const page = { ...newContent.content_pages[contentIndex] };
          if (field === "title") page.title = value as string;
          if (field === "intro_paragraph") page.intro_paragraph = value as string;
          if (field === "points") page.points = value as string[];
          if (field === "blockquote_text") page.blockquote_text = value as string;
          newContent.content_pages = [...newContent.content_pages];
          newContent.content_pages[contentIndex] = page;
        }
      }
      setCarouselContent(newContent);
    },
    [carouselContent, slides.length]
  );

  const handleDownloadSlide = useCallback(async (index: number) => {
    const el = slideRefs.current[index];
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { quality: 1.0, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `slide-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download error:", err);
    }
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!carouselContent) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const elements = slideRefs.current.filter((el) => el !== null) as HTMLDivElement[];
      for (let i = 0; i < elements.length; i++) {
        const dataUrl = await toPng(elements[i], { quality: 1.0, pixelRatio: 3 });
        zip.file(`slide-${i + 1}.png`, dataUrl.split(",")[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "carousel.zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast({ title: "Ошибка", description: "Не удалось создать архив", variant: "destructive" });
    } finally {
      setIsZipping(false);
    }
  }, [carouselContent, toast]);

  return (
    <div className="p-6 max-w-[1600px]">
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">{"Генератор каруселей"}</h1>
          <HelpButton
            title="Помощь: Генератор каруселей"
            sections={[
              { title: "Что это?", content: "Инструмент для создания каруселей (слайдов) для Threads и Instagram с помощью AI. Задайте тему, выберите количество слайдов и дизайн -- AI создаст контент, который вы можете отредактировать и скачать." },
              { title: "Как использовать?", content: "1. Введите тему карусели\n2. Укажите CTA-слово (призыв к действию)\n3. Выберите количество слайдов (3-10)\n4. Нажмите \"Сгенерировать\"\n5. Выберите дизайн-тему\n6. Отредактируйте текст при необходимости\n7. Скачайте отдельные слайды или весь архив" },
              { title: "Дизайн-темы", content: "Apple Notes -- светлая тема в стиле заметок\niOS Journal -- стиль iOS-дневника\nDark Editorial -- темная редакторская тема\nPersonal Brand -- темный стиль для личного бренда" },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-1">{"Создание каруселей для Threads / Instagram с помощью ИИ"}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-6">
        <div className="space-y-4">
          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <Label>{"Тема карусели"}</Label>
                <Textarea
                  placeholder="О чём будет карусель..."
                  className="resize-none text-sm"
                  rows={4}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  data-testid="textarea-carousel-topic"
                />
              </div>

              <div className="space-y-2">
                <Label>{"CTA-слово (призыв к действию)"}</Label>
                <Input
                  placeholder="напр. ГАЙД, ПОДПИШИСЬ, СТРЕСС"
                  value={ctaKeyword}
                  onChange={(e) => setCtaKeyword(e.target.value)}
                  data-testid="input-cta-keyword"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{"Слайдов"}</Label>
                    <span className="text-sm font-mono text-muted-foreground">{numSlides}</span>
                  </div>
                  <Slider
                    value={[numSlides]}
                    onValueChange={([v]) => setNumSlides(v)}
                    min={3}
                    max={10}
                    step={1}
                    data-testid="slider-num-slides"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LLM</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger data-testid="select-llm-model">
                      <SelectValue placeholder="По умолч." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{"По умолчанию"}</SelectItem>
                      {activeSettings.map((s) => (
                        <SelectItem key={s.id} value={`${s.provider}:${s.modelId}`}>
                          {s.displayName}
                          {s.isDefault ? " \u2605" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                onClick={() => generateMutation.mutate()}
                disabled={!topic || generateMutation.isPending}
                data-testid="button-generate-carousel"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {"Генерация..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {"Сгенерировать карусель"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardContent className="p-5 space-y-4">
              <Label>{"Дизайн-тема"}</Label>
              <div className="grid grid-cols-2 gap-3">
                {DESIGNS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDesign(d.id)}
                    className={`relative w-full aspect-video rounded-md overflow-hidden transition-all ${
                      selectedDesign === d.id
                        ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-background"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: d.bgColor, border: `1px solid ${d.borderColor}` }}
                    data-testid={`button-design-${d.id}`}
                  >
                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                      <span className="text-2xl font-bold mb-1" style={{ color: d.textColor }}>Aa</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: d.textColor, backgroundColor: "rgba(128,128,128,0.15)" }}>
                        {d.name}
                      </span>
                    </div>
                    {selectedDesign === d.id && (
                      <div className="absolute top-1.5 right-1.5 bg-purple-500 rounded-full p-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {carouselContent && (
            <Card className="overflow-visible">
              <CardContent className="p-5 space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                  data-testid="button-download-zip"
                >
                  {isZipping ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {"Создание архива..."}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {"Скачать все (ZIP)"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {carouselContent ? (
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400">
                  {"Сгенерировано"}
                </Badge>
                <span className="text-sm text-muted-foreground">{slides.length} {"слайдов"}</span>
              </div>
              <div className="flex flex-wrap gap-8 pb-8">
                {slides.map((slide, index) => (
                  <div key={index} className="group relative">
                    <div
                      ref={(el) => {
                        slideRefs.current[index] = el;
                      }}
                      className="shadow-2xl"
                    >
                      <SlideRenderer
                        slide={slide}
                        design={selectedDesign}
                        slideIndex={index}
                        totalSlides={slides.length}
                        onUpdate={(field, value) => handleUpdateContent(index, field, value)}
                      />
                    </div>
                    <div className="flex justify-center mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground invisible group-hover:visible"
                        onClick={() => handleDownloadSlide(index)}
                        data-testid={`button-download-slide-${index}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        PNG
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <Image className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">{"Введите тему и нажмите \"Сгенерировать\" для создания карусели"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
