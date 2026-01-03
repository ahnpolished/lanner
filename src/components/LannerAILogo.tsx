import lannerAILogo from "data-base64:assets/lanner_ai.png"

type LannerAILogoProps = {
    variant?: "default" | "small"
} & React.HTMLAttributes<HTMLDivElement>
export const LannerAILogo = ({ variant = "default", ...props }: LannerAILogoProps) => {
    return (
        <div {...props}>
            <img src={lannerAILogo} alt="Lanner AI Logo" />
        </div>
    )
}