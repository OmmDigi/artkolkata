import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

interface IProps {
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  message: string | null | undefined;
}

export default function ViewDescriptionDialog({
  isOpen,
  setOpen,
  message,
}: IProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Full Message</DialogTitle>
        <ScrollArea className="max-h-[80vh]">
          <DialogDescription>{message}</DialogDescription>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
