import { Eye, EyeOff } from "lucide-react";
import React, { FC, InputHTMLAttributes, useState } from "react";

interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** classes for the wrapper — margins go here rather than on the input */
  wrapperClassName?: string;
}

/**
 * A password field with a show/hide toggle. Every other prop goes to the
 * input, so it drops in wherever an <input type="password"> was.
 */
const PasswordInput: FC<PasswordInputProps> = ({
  wrapperClassName = "",
  className = "",
  ...inputProps
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...inputProps}
        type={visible ? "text" : "password"}
        // room on the right so the text never runs under the toggle
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-800"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

export default PasswordInput;
