const order_template = {
    payment_method: "cod",
    payment_method_title: "Cash on delivery",
    set_paid: true,
    billing: {
      first_name: "John",
      last_name: "Doe",
      address_1: "969 Market",
      address_2: "",
      city: "San Francisco",
      state: "CA",
      postcode: "94103",
      country: "US",
      email: "john.doe@example.com",
      phone: "(555) 555-5555"
    },
    shipping: {
      first_name: "John",
      last_name: "Doe",
      address_1: "969 Market",
      address_2: "",
      city: "San Francisco",
      state: "CA",
      postcode: "94103",
      country: "US"
    },
    line_items: [
    ],
    shipping_lines: [
      {
        method_id: "free_shipping",
        method_title: "Free Shipping",
        total: "0.00"
      }
    ]
  };

  module.exports = {
    order_template: order_template
  };