import { CheckCircle2, Download, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

export default function QRConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { orderId?: string; meal?: string; slot?: string; amount?: number } | null;

  const orderId = state?.orderId || "#MM10234";
  const meal = state?.meal || "Chicken Biryani";
  const slot = state?.slot || "12:30 – 1:00";
  const amount = state?.amount || 350;

  const qrData = JSON.stringify({ orderId, meal, slot, amount, timestamp: Date.now() });

  const handleDownloadQR = () => {
    const svg = document.querySelector("#qr-code-svg svg") as SVGElement;
    if (!svg) { toast.error("Could not generate QR download"); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 300, 300);
      const link = document.createElement("a");
      link.download = `MealMate-${orderId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("QR code downloaded! 📥");
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="bg-success/10 rounded-2xl p-4 flex items-center gap-3 border border-success/20">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <p className="font-bold text-success text-sm">Your order has been successfully placed! 🎉</p>
      </div>

      <Card className="rounded-3xl bg-card border border-border shadow-card">
        <CardContent className="p-6 space-y-6 text-center">
          <h1 className="text-xl font-bold">Order Confirmation ✅</h1>

          <div className="grid grid-cols-2 gap-3 text-left text-sm">
            <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Order ID</p><p className="font-bold">{orderId}</p></div>
            <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Meal</p><p className="font-bold">{meal}</p></div>
            <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Pickup Time</p><p className="font-bold flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-primary" /> {slot}</p></div>
            <div className="bg-secondary rounded-2xl p-3"><p className="text-muted-foreground text-xs font-medium">Total Paid</p><p className="font-bold text-accent">Rs {amount}</p></div>
          </div>

          <div className="flex flex-col items-center gap-3 py-4" id="qr-code-svg">
            <div className="p-4 bg-card border-2 border-border rounded-2xl shadow-card">
              <QRCodeSVG value={qrData} size={180} bgColor="white" fgColor="#FF8C42" level="M" includeMargin={false} />
            </div>
            <p className="text-xs text-muted-foreground font-medium">Scan this QR code at the cafeteria counter 📱</p>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 rounded-full border border-border bg-card py-2.5 font-bold text-foreground flex items-center justify-center gap-2 transition-all hover:shadow-card-hover hover:scale-[1.02] text-sm" onClick={handleDownloadQR}>
              <Download className="h-4 w-4" /> Download QR
            </button>
            <button className="flex-1 gradient-primary text-primary-foreground rounded-full py-2.5 font-bold transition-all hover:opacity-90 hover:scale-[1.02] text-sm" onClick={() => navigate("/order-history")}>
              View Orders
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
