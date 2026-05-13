export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
    const tenant = {
        institute: {
            id: '1',
            settings: {
                seo: {

                }
            }
        }
    }
    return <div>{children}</div>
}

export const useTenant = () => {
    return {
        tenant: {
            institute: {
                id: '1',
                settings: {
                    seo: {
                        
                    }
                }
            }
        }
    }
}