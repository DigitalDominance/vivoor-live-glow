import React from "react";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  isVerified: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  isVerified, 
  size = "md", 
  className 
}) => {
  if (!isVerified) return null;

  const sizeClasses = {
    sm: "size-3",
    md: "size-4", 
    lg: "size-5"
  };

  return (
    <div className={cn(
      "inline-flex items-center justify-center rounded-full bg-blue-600 text-white",
      size === "sm" && "p-0.5",
      size === "md" && "p-1",
      size === "lg" && "p-1.5",
      className
    )}>
      <Shield className={sizeClasses[size]} />
    </div>
  );
};

export default VerifiedBadge;