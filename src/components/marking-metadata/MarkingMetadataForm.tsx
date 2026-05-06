import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    MARKING_ATTRIBUTE_KIND,
    MarkingAttribute,
    MarkingType,
} from "@/lib/markings/MarkingType";

type Props = {
    markingType: MarkingType;
    values: Record<string, string>;
    onChange: (attributeId: string, optionId: string) => void;
};

function getOptions(attribute: MarkingAttribute) {
    if (attribute.kind === MARKING_ATTRIBUTE_KIND.CHOICE) {
        return attribute.options;
    }
    return attribute.ranges ?? [];
}

export function MarkingMetadataForm({ markingType, values, onChange }: Props) {
    const attributes = markingType.attributes ?? [];

    if (attributes.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            {attributes.map(attribute => {
                const options = getOptions(attribute);
                const selected = values[attribute.id] ?? "";
                const unit =
                    attribute.kind === MARKING_ATTRIBUTE_KIND.SIZE
                        ? attribute.unit
                        : undefined;

                return (
                    <fieldset
                        key={attribute.id}
                        className="border rounded-md p-3"
                    >
                        <legend className="px-1 text-sm font-medium">
                            {attribute.label}
                            {unit ? ` (${unit})` : ""}
                        </legend>
                        <RadioGroup
                            value={selected}
                            onValueChange={value =>
                                onChange(attribute.id, value)
                            }
                        >
                            {options.map(option => {
                                const itemId = `metadata-opt-${option.id}`;
                                return (
                                    <div
                                        key={option.id}
                                        className="flex items-center gap-2"
                                    >
                                        <RadioGroupItem
                                            value={option.id}
                                            id={itemId}
                                        />
                                        <Label
                                            htmlFor={itemId}
                                            className="text-sm"
                                        >
                                            {option.label}
                                        </Label>
                                    </div>
                                );
                            })}
                        </RadioGroup>
                    </fieldset>
                );
            })}
        </div>
    );
}
