import { Link } from "@remix-run/react";
import { Phone, Stethoscope } from "lucide-react";
import { SITE_CONFIG } from "~/config/site";

export function CartHelpBlock() {
  const { phone } = SITE_CONFIG.contact;

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <Phone className="h-4 w-4 text-blue-600" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">
            Un doute sur la compatibilité ?
          </p>
          <a
            href={`tel:${phone.raw}`}
            className="block text-lg font-bold text-blue-600 hover:text-blue-800"
          >
            {phone.display}
          </a>
          <p className="text-xs text-slate-500">{phone.hours}</p>
          <Link
            to="/diagnostic-auto"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Diagnostic gratuit
          </Link>
        </div>
      </div>
    </div>
  );
}
