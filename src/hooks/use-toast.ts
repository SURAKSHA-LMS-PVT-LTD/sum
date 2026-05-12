export const useToast = () => {
    return {
        toast: ({ title, description, variant }: { title: string, description: string, variant?: string }) => {
            console.log(title, description, variant);
        }
    }
}