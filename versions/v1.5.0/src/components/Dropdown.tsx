import React from 'react';

interface DropdownProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ 
  options, 
  value, 
  onChange, 
  label, 
  className = '' 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`dropdown-container ${className}`}>
      {label && <label className="dropdown-label">{label}</label>}
      <select 
        className="dropdown-select"
        value={value}
        onChange={handleChange}
      >
        <option value="">-- 请选择 --</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Dropdown; 