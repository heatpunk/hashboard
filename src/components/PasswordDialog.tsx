import { useEffect, useState } from "react";
import { useMiners } from "@/store/miners";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PasswordDialog() {
  const pwPrompt = useMiners((s) => s.pwPrompt);
  const submit = useMiners((s) => s.submitMinerPassword);
  const dismiss = useMiners((s) => s.dismissPwPrompt);
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (pwPrompt) setPw("");
  }, [pwPrompt]);

  return (
    <Dialog open={!!pwPrompt} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-xs" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="tracking-display text-xs font-medium">
            Miner password
          </DialogTitle>
          <DialogDescription className="text-xs">
            This miner requires a password for control. Enter its BraiinsOS+ password (username: root). It is stored only on this device.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); submit(pw); }}
          className="space-y-3 pt-1"
        >
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="font-readout"
          />
          <Button type="submit" size="sm" className="w-full text-xs">
            Connect
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
