import gamingImg from "@/assets/category-gaming.jpg";
import musicImg from "@/assets/category-music.jpg";
import irlImg from "@/assets/category-irl.jpg";
import cryptoImg from "@/assets/category-crypto.jpg";
import talkImg from "@/assets/category-talk.jpg";
import sportsImg from "@/assets/category-sports.jpg";
import techImg from "@/assets/category-tech.jpg";

export const categoryThumbnails: Record<string, string> = {
  'Gaming': gamingImg,
  'Music': musicImg,
  'IRL': irlImg,
  'Crypto': cryptoImg,
  'Talk': talkImg,
  'Sports': sportsImg,
  'Tech': techImg,
};

export const getCategoryThumbnail = (category: string): string => {
  return categoryThumbnails[category] || gamingImg; // Default to gaming if category not found
};