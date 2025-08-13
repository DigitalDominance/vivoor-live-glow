import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export type Vod = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  created_at: string;
};

const VodCard: React.FC<{ vod: Vod }> = ({ vod }) => {
  const navigate = useNavigate();
  return (
    <motion.article
      className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-colors"
      whileHover={{ translateY: -2 }}
      onClick={() => navigate(`/vod/${vod.id}`)}
    >
      <div className="relative aspect-video bg-muted/40">
        {vod.thumbnail_url && (
          <img src={vod.thumbnail_url} alt={`${vod.title} replay thumbnail`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-medium truncate" title={vod.title}>{vod.title}</div>
        <div className="text-xs text-muted-foreground">{new Date(vod.created_at).toLocaleString()}</div>
      </div>
    </motion.article>
  );
};

export default VodCard;
