import { cn } from "@/lib/utils";

interface IProps {
  children: React.ReactNode;
  className?:string
}
export default function Section({ children, className }: IProps) {
  return (
    <section className={cn(
      "bg-[#ffffff] border border-gray-100 rounded-3xl p-9 shadow-xl space-y-4",
      className
    )}>
      {children}
    </section>
  );
}
