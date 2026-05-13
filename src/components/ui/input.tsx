export const Input = ({ value, onChange, placeholder, maxLength }: { value: string, onChange: (e: any) => void, placeholder: string, maxLength: number }) => {
    return <input value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} />
}