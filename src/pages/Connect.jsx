import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, Sparkles, Bot, MousePointerClick, Link2, RefreshCw, ShieldCheck } from "lucide-react";

const SERVER_URL = new URL("/api/mcp", window.location.origin).toString();

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? <Check className="w-4 h-4 text-[hsl(var(--chart-3))]" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-sm leading-relaxed text-foreground">{children}</span>
    </li>
  );
}

export default function Connect() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Connect your AI assistant</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Let AI tools like Claude, ChatGPT, and Cursor read your listings, manage orders, and act on your behalf in UKMarketStore.
          Your assistant only ever acts as you, with the permissions your account has.
        </p>
      </div>

      {/* Server URL */}
      <div className="rounded-xl border border-border bg-card p-4 mb-8">
        <label className="text-xs font-medium text-muted-foreground mb-2 block">MCP Server URL</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg bg-secondary px-3 py-2 text-sm font-mono text-foreground">
            {SERVER_URL}
          </code>
          <CopyButton value={SERVER_URL} />
        </div>
      </div>

      <Tabs defaultValue="claude" className="w-full">
        <TabsList className="grid grid-cols-4 w-full mb-6 h-auto py-1">
          <TabsTrigger value="claude" className="flex-col gap-1 py-2 text-xs">
            <Bot className="w-4 h-4" /> Claude
          </TabsTrigger>
          <TabsTrigger value="chatgpt" className="flex-col gap-1 py-2 text-xs">
            <Sparkles className="w-4 h-4" /> ChatGPT
          </TabsTrigger>
          <TabsTrigger value="cursor" className="flex-col gap-1 py-2 text-xs">
            <MousePointerClick className="w-4 h-4" /> Cursor
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-col gap-1 py-2 text-xs">
            <Link2 className="w-4 h-4" /> Custom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claude">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Connect Claude</h2>
            <ol className="space-y-3">
              <Step n={1}>Open Claude and go to your profile menu → <strong>Settings</strong>.</Step>
              <Step n={2}>Select <strong>Connectors</strong>, then <strong>Add custom connector</strong>.</Step>
              <Step n={3}>Name the connector (e.g. "UKMarketStore") and paste the server URL above.</Step>
              <Step n={4}>Click <strong>Add</strong>.</Step>
              <Step n={5}>Claude opens the UKMarketStore consent page — sign in with your app account and <strong>Approve</strong>.</Step>
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="chatgpt">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Connect ChatGPT</h2>
            <ol className="space-y-3">
              <Step n={1}>Go to <strong>Apps</strong> and enable <strong>Developer mode</strong> (accept the warning ChatGPT shows).</Step>
              <Step n={2}>Click <strong>Create app</strong> and give it a name.</Step>
              <Step n={3}>Paste the server URL above and click <strong>Create</strong>.</Step>
              <Step n={4}>From the chat composer, enable the app before prompting it.</Step>
              <Step n={5}>ChatGPT opens the UKMarketStore consent page — sign in with your app account and <strong>Approve</strong>.</Step>
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="cursor">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><MousePointerClick className="w-5 h-5 text-primary" /> Connect Cursor</h2>
            <ol className="space-y-3">
              <Step n={1}>Open <strong>Settings → Tools &amp; Integrations</strong> and click <strong>New MCP Server</strong>.</Step>
              <Step n={2}>This opens your <code className="text-xs bg-secondary px-1 rounded">mcp.json</code> file.</Step>
              <Step n={3}>Add an entry whose <code className="text-xs bg-secondary px-1 rounded">url</code> is the server URL above, then save.</Step>
              <Step n={4}>Toggle the new server on.</Step>
              <Step n={5}>Cursor opens the UKMarketStore consent page — sign in with your app account and <strong>Approve</strong>.</Step>
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="custom">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Custom client</h2>
            <ol className="space-y-3">
              <Step n={1}>Copy the server URL above.</Step>
              <Step n={2}>Add it as a <strong>streamable HTTP</strong> MCP server in your client.</Step>
              <Step n={3}>Most clients only need a name and the URL — add them and reload the client.</Step>
              <Step n={4}>Your client opens the UKMarketStore consent page — sign in with your app account and <strong>Approve</strong>.</Step>
            </ol>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <div className="mt-8 space-y-3">
        <div className="flex gap-3 rounded-xl bg-primary/5 border border-primary/20 p-4">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">You're in control.</strong> Because UKMarketStore requires sign-in, your assistant only ever acts as you — it can only see and do what your account is allowed to. Revoke access anytime from your AI client's settings.
          </p>
        </div>
        <div className="flex gap-3 rounded-xl bg-secondary/60 p-4">
          <RefreshCw className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Refresh the connector</strong> after we ship changes to the app — assistants cache the tool list, so a refresh picks up new or updated tools.
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">Back to home</Link>
      </div>
    </div>
  );
}