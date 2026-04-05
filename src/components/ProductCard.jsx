import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5"
    >
      <div className="aspect-square overflow-hidden bg-muted relative">
        <img
          src={product.image_url}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          decoding="async"
        />
        {product.condition && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] backdrop-blur-md bg-card/80">
            {product.condition}
          </Badge>
        )}
        {product.status === "sold" && (
          <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
            <span className="text-white font-bold text-lg tracking-wide">SOLD</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{product.title}</h3>
        <p className="text-primary font-bold text-lg mt-0.5">
          £{product.price?.toFixed(2)}
        </p>
        <div className="flex items-center gap-1 mt-1.5 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span className="text-xs">{product.postcode}</span>
        </div>
      </div>
    </Link>
  );
}