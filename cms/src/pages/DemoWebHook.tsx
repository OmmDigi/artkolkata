import Section from "@/components/Section";
import SelectInput from "@/components/SelectInput";
import LabelInput from "@/components/LabelInput";
import { Button } from "@/components/ui/button";
import { useDoMutation } from "@/hooks/useDoMutation";

const dataToSet: Record<string, any> = {
  "ORDER CONFIRMED": {
    Shipment: {
      Status: {
        Status: "Manifested",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "UD",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh) 1",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "",
    },
  },
  "ORDER SHIPPED": {
    Shipment: {
      Status: {
        Status: "Pending",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "UD",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  "OUT FOR DELIVERY": {
    Shipment: {
      Status: {
        Status: "Dispatched",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "UD",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  "ORDER DELIVERED": {
    Shipment: {
      Status: {
        Status: "Delivered",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "DL",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  "RETURN INITIATED": {
    Shipment: {
      Status: {
        Status: "Open",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "PP",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  RETURNED: {
    Shipment: {
      Status: {
        Status: "RTO",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "DL",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  "ORDER RETURNED" : {
    Shipment: {
      Status: {
        Status: "RTO",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "DL",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
  "CANCEL INITIATED": {
    Shipment: {
      Status: {
        Status: "Canceled",
        StatusDateTime: "2019-01-09T17:10:42.767",
        StatusType: "CN",
        StatusLocation: "Chandigarh_Raiprkln_C (Chandigarh)",
        Instructions: "Manifest uploaded",
      },
      PickUpDate: "2019-01-09 17:10:42.543",
      NSLCode: "X-UCI",
      Sortcode: "IXC/MDP",
      ReferenceNo: "28",
      AWB: "84871710000044",
    },
  },
};

export default function DemoWebHook() {
  const { isLoading, mutate } = useDoMutation();
  return (
    <div className="grid grid-cols-2">
      <Section>
        <h2 className="font-semibold text-2xl">Delivery Demo Dashboard</h2>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const key = formData.get("action")?.toString() ?? "";
            const dataToSend = dataToSet[key];
            dataToSend.Shipment.AWB = formData.get("tracking_id");
            mutate({
              apiPath: "/api/v1/webhook/order-status",
              method: "post",
              formData: dataToSend,
              headers: {
                Authentication: `Key r11i58OS!DRUkug!CrI_lm&x?`,
              },
            });
          }}
        >
          <LabelInput
            name="tracking_id"
            placeholder="Enter tracking id"
            label="Tracking id"
          />
          <SelectInput
            name="action"
            options={[
              { text: "ORDER CONFIRMED", value: "ORDER CONFIRMED" },
              { text: "ORDER SHIPPED", value: "ORDER SHIPPED" },
              { text: "OUT FOR DELIVERY", value: "OUT FOR DELIVERY" },
              { text: "ORDER DELIVERED", value: "ORDER DELIVERED" },
              { text: "RETURN INITIATED", value: "RETURN INITIATED" },
              {text : "ORDER RETURNED", value : "ORDER RETURNED"},
              { text: "CANCEL INITIATED", value: "CANCEL INITIATED" },
            ]}
            label="Choose status"
          />
          <Button disabled={isLoading}>Save</Button>
        </form>
      </Section>
    </div>
  );
}
