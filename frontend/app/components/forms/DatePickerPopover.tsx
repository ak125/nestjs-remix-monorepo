/**
 * DatePickerPopover - Sélecteur de date avec calendrier dans un popover
 *
 * @features
 * - Calendrier interactif pour sélection de date
 * - Navigation par mois (précédent/suivant)
 * - Affichage de la date sélectionnée formatée
 * - Placeholder personnalisable
 * - Callback onChange avec Date object
 * - Désactivation des dates passées (optionnel)
 *
 * @example
 * <DatePickerPopover
 *   value={selectedDate}
 *   onChange={setSelectedDate}
 *   placeholder="Sélectionner une date"
 *   disablePast
 * />
 */

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, memo } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface DatePickerPopoverProps {
  /** Date sélectionnée */
  value?: Date;
  /** Callback lors du changement de date */
  onChange?: (date: Date) => void;
  /** Texte placeholder */
  placeholder?: string;
  /** Désactiver les dates passées */
  disablePast?: boolean;
  /** Date minimum */
  minDate?: Date;
  /** Date maximum */
  maxDate?: Date;
  /** Classe CSS personnalisée */
  className?: string;
}

export const DatePickerPopover = memo(function DatePickerPopover({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  disablePast = false,
  minDate,
  maxDate,
  className = "",
}: DatePickerPopoverProps) {
  const [currentMonth, setCurrentMonth] = useState(
    value ? new Date(value.getFullYear(), value.getMonth(), 1) : new Date(),
  );

  // Format date pour affichage
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  // Format mois/année pour header
  const formatMonthYear = (date: Date) => {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(date);
  };

  // Obtenir les jours du mois
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Ajouter les jours vides au début
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Vérifier si une date est désactivée
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (disablePast && date < today) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Vérifier si une date est sélectionnée
  const isDateSelected = (date: Date) => {
    if (!value) return false;
    return (
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear()
    );
  };

  // Vérifier si c'est aujourd'hui
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Navigation mois
  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  // Sélection de date
  const handleDateSelect = (date: Date) => {
    if (!isDateDisabled(date)) {
      onChange?.(date);
    }
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm hover:border-blue-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${className}`}
        >
          <span className={value ? "text-gray-900" : "text-gray-500"}>
            {value ? formatDate(value) : placeholder}
          </span>
          <Calendar className="h-4 w-4 text-gray-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {/* Header avec navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="text-sm font-semibold text-gray-900">
              {formatMonthYear(currentMonth)}
            </div>
            <button
              onClick={goToNextMonth}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 gap-1">
            {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grille de dates */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const disabled = isDateDisabled(date);
              const selected = isDateSelected(date);
              const today = isToday(date);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDateSelect(date)}
                  disabled={disabled}
                  className={`aspect-square rounded-md text-sm transition-colors ${
                    selected
                      ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                      : today
                        ? "border-2 border-blue-600 bg-white font-semibold text-blue-600 hover:bg-blue-50"
                        : disabled
                          ? "cursor-not-allowed text-gray-300"
                          : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer avec raccourcis */}
          <div className="flex gap-2 border-t border-gray-200 pt-3">
            <button
              onClick={() => handleDateSelect(new Date())}
              className="flex-1 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              Aujourd'hui
            </button>
            {value && (
              <button
                onClick={() => onChange?.(undefined as any)}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Effacer
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
