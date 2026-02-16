import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const AIChatPanel = ({ messages, onSendMessage, isLoading }: AIChatPanelProps) => {
  const [input, setInput] = useState("");

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInput("");
    }
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple" />
          Chat with AI
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ask for meal suggestions, cooking tips, or recipe modifications.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm p-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-purple/10 text-right ml-8"
                  : "bg-gray-100 mr-8"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="bg-gray-100 text-sm p-2 rounded-lg mr-8">
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about meals..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-purple hover:bg-purple-dark"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIChatPanel;
