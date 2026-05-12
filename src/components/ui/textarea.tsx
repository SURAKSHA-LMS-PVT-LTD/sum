export const Textarea = ({ value, onChange, placeholder, maxLength, rows }: { value: string, onChange: (e: any) => void, placeholder: string, maxLength: number, rows: number }) => {
    return <textarea value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} rows={rows} />
}