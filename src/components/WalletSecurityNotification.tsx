import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

export const WalletSecurityNotification: React.FC = () => {
  return (
    <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
      <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
      <AlertDescription className="text-green-800 dark:text-green-200">
        <strong>Enhanced Security:</strong> You will now be asked to sign a message to verify wallet ownership when connecting. 
        This prevents unauthorized access to your account.
      </AlertDescription>
    </Alert>
  );
};