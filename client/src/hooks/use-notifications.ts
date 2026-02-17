import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export function useNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!user) return;

    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;

        if (data.type === "publish_success") {
          toast({
            title: "Публикация успешна",
            description: `${data.data.postCount} постов опубликовано${data.data.accountUsername ? ` (@${data.data.accountUsername})` : ""}`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
        }

        if (data.type === "publish_failed") {
          toast({
            title: "Ошибка публикации",
            description: data.data.error?.substring(0, 200) || "Неизвестная ошибка",
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
        }

        if (data.type === "engagement_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        if (!eventSourceRef.current && user) {
          const reconnect = new EventSource("/api/notifications/stream");
          eventSourceRef.current = reconnect;
          reconnect.onmessage = es.onmessage;
          reconnect.onerror = () => {
            reconnect.close();
            eventSourceRef.current = null;
          };
        }
      }, 5000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [user, toast]);
}
