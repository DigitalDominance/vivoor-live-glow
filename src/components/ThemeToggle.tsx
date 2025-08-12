import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/theme/ThemeProvider";

export const ThemeToggle = () => {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="glass"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
      className="relative overflow-hidden"
    
    >
      <div className="relative flex items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          {isDark ? (
            <motion.span key="moon" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <Moon aria-hidden className="" />
            </motion.span>
          ) : (
            <motion.span key="sun" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <Sun aria-hidden className="" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Button>
  );
};
