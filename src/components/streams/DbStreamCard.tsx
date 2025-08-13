import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export type DbStream = {
  id: string;
  title: string;
  category: string | null;
  is_live: boolean;
  viewers: number | null;
  thumbnail_url: string | null;
  user_id: string;
};

export type DbProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const DbStreamCard: React.FC<{ stream: DbStream; profile?: DbProfile | null; }>= ({ stream, profile }) => {
  const navigate = useNavigate();
  const username = profile?.handle || profile?.display_name || 'creator';
  return (
    <motion.article
      className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-colors"
      whileHover={{ translateY: -2 }}
      onClick={() => navigate(`/watch/${stream.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/watch/${stream.id}`)}
    >
      <div className="relative aspect-video bg-muted/40">
        {stream.thumbnail_url && (
          <img src={stream.thumbnail_url} alt={`${stream.title} thumbnail`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        <Button variant="glass" size="sm" className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">Watch</Button>
        {stream.is_live ? (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-grad-primary text-[hsl(var(--on-gradient))]">LIVE</span>
        ) : (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-medium bg-background/80 border border-border">Replay</span>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate" title={stream.title}>{stream.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{stream.category || 'General'} • {stream.viewers ?? 0} viewers</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">@{username}</div>
      </div>
    </motion.article>
  );
};

export default DbStreamCard;
