export const Button = ({ children, disabled, onClick }: { children: React.ReactNode, disabled: boolean, onClick: () => void }) => {
    return <button onClick={onClick} disabled={disabled}>{children}</button>
}