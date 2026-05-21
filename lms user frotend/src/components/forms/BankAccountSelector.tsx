import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';
import { instituteBankAccountsApi, type InstituteBankAccount } from '@/api/instituteBankAccounts.api';
import { SRI_LANKAN_BANKS } from '@/config/sriLankanBanks';

interface Props {
  instituteId: string;
  value: string;
  onChange: (accountId: string, account: InstituteBankAccount | null) => void;
  error?: string;
  required?: boolean;
}

export const BankAccountSelector: React.FC<Props> = ({ instituteId, value, onChange, error, required }) => {
  const [accounts, setAccounts] = useState<InstituteBankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    instituteBankAccountsApi.list(instituteId, false)
      .then(data => { if (!cancelled) setAccounts(data); })
      .catch(() => { if (!cancelled) setAccounts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [instituteId]);

  const selected = accounts.find(a => a.id === value) ?? null;
  const logo = selected ? SRI_LANKAN_BANKS.find(b => b.name === selected.bankName)?.logoUrl : undefined;

  return (
    <div className="space-y-1.5">
      <Label>Bank Account{required && ' *'}</Label>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts…
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No bank accounts configured. Ask your institute admin to add one in Institute Settings.</p>
      ) : (
        <Select value={value} onValueChange={id => onChange(id, accounts.find(a => a.id === id) ?? null)}>
          <SelectTrigger className={`h-auto p-2 ${error ? 'border-red-500' : ''}`}>
            {selected ? (
              <div className="flex items-center gap-2">
                {logo ? (
                  <img src={logo} alt={selected.bankName} className="h-6 w-6 object-contain rounded" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="text-left">
                  <div className="text-sm font-medium">{selected.label}</div>
                  <div className="text-xs text-muted-foreground">{selected.bankName}{selected.branch ? ` · ${selected.branch}` : ''} · {selected.accountNumber}</div>
                </div>
              </div>
            ) : (
              <SelectValue placeholder="Select bank account…" />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {accounts.map(acc => {
              const accLogo = SRI_LANKAN_BANKS.find(b => b.name === acc.bankName)?.logoUrl;
              return (
                <SelectItem key={acc.id} value={acc.id} className="py-2">
                  <div className="flex items-center gap-2">
                    {accLogo ? (
                      <img src={accLogo} alt={acc.bankName} className="h-6 w-6 object-contain rounded" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{acc.label}</div>
                      <div className="text-xs text-muted-foreground">{acc.bankName}{acc.branch ? ` · ${acc.branch}` : ''} · {acc.accountHolderName} · {acc.accountNumber}</div>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
