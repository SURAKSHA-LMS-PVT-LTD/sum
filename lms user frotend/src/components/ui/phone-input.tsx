import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, 'type' | 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  countryCode?: string;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value = '', onChange, countryCode = '+94', ...props }, ref) => {
    const formatPhoneNumber = (input: string): string => {
      // Remove all non-digit characters
      const cleaned = input.replace(/\D/g, '');
      
      // If empty, return country code
      if (!cleaned) return countryCode;
      
      // Start with country code
      let formatted = countryCode + ' ';
      
      // Get digits after country code (94)
      const localDigits = cleaned.startsWith('94') ? cleaned.slice(2) : cleaned;
      
      // Format: +94 72 785 3979
      if (localDigits.length === 0) {
        return countryCode;
      } else if (localDigits.length <= 2) {
        formatted += localDigits;
      } else if (localDigits.length <= 5) {
        formatted += localDigits.slice(0, 2) + ' ' + localDigits.slice(2);
      } else {
        formatted += localDigits.slice(0, 2) + ' ' + localDigits.slice(2, 5) + ' ' + localDigits.slice(5, 9);
      }
      
      return formatted;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      onChange?.(formatted);
    };

    return (
      <Input
        type="tel"
        className={cn("font-mono", className)}
        value={value || countryCode}
        onChange={handleChange}
        placeholder="+94 72 785 3979"
        ref={ref}
        {...props}
      />
    )
  }
)
PhoneInput.displayName = "PhoneInput"

export { PhoneInput }
