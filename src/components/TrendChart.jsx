"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../context/UserContext";

export default function TrendChart() {
  const [analyticsUrl, setAnalyticsUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  useEffect(() => {
    async function fetchAnalyticsUrl() {
      if (!user?.email) return setLoading(false);
      const { data, error } = await supabase
        .from("users")
        .select("data_analytics_url")
        .eq("email", user.email)
        .single();
      if (!error && data && data.data_analytics_url) {
        setAnalyticsUrl(data.data_analytics_url);
      }
      setLoading(false);
    }
    fetchAnalyticsUrl();
  }, [user]);

  return (
    <section className="rounded-2xl shadow-lg bg-white/90 border border-blue-100 px-2 md:px-6 py-6 flex flex-col items-center">
      <h2 className="text-indigo-700 font-semibold mb-4 text-lg md:text-xl">
        Teaching Style Analytics
      </h2>
      <div className="w-full flex justify-center">
        <div className="w-full" style={{ aspectRatio: "16/9", minHeight: 350 }}>
          {!loading && analyticsUrl ? (
            <iframe
              src={analyticsUrl}
              width="100%"
              height="100%"
              style={{
                border: 0,
                borderRadius: 16,
                width: "100%",
                height: "100%",
                minHeight: 350,
                display: "block",
              }}
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="Teaching Style Analytics"
            />
          ) : (
            <div className="flex items-center justify-center h-full w-full text-gray-400">
              {loading ? "Loading chart..." : "No analytics URL found."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
