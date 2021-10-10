require('dotenv').config();

const order_template = require('./order');
const express = require('express')
const axios = require('axios').default
const crypto = require('crypto')
const OAuth = require('oauth-1.0a')
const app = express()
const port = process.env.PORT;

const store_url = process.env.STORE_URL;
 
const oauth = OAuth({
    consumer: { key: process.env.CONSUMER_KEY, secret: process.env.CONSUMER_SECRET },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto
            .createHmac('sha1', key)
            .update(base_string)
            .digest('base64')
    },
})


const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const { Console } = require('console');
 
const api = new WooCommerceRestApi({
  url: store_url,
  consumerKey: "ck_e4b7f4e777d69ca5ea671be1a828461af098e56d",
  consumerSecret: "cs_ed3303227c1c92e5f96e13150696d9040d886a7e",
  version: "wc/v3",
  queryStringAuth: true
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

//------------------------------------
//
// Retrieve products
//
//------------------------------------

app.get("/products", (req, res) => {

  //Validate a user

  var token = req.header('Authorization');
  axios.post(store_url + "/wp-json/jwt-auth/v1/token/validate", null, {
    headers: {
      'Authorization': token,
      'Content-Type' : 'application/json; charset=utf-8',
    }
  })
  .then(response => {
    if(response.data.statusCode != 200){
      return res.json(response.data);
    }

    //If valiidated, get products

    api.get("products", {
      per_page: 100,
      stock_status: "instock",
    })
    .then(response => {
      var products = [];
      for(var product of response.data){
        var images = [];
        for(var image of product.images){
          var temp = {
            id: image.id,
            src: image.src,
          }
          images.push(temp);
        }

        var categories = [];
        for(var category of product.categories){
          var temp = {
            id: category.id,
            name: category.name,
          }
          categories.push(temp);
        }

        var tags = [];
        for(var tag of product.tags){
          var temp = {
            id: tag.id,
            name: tag.name
          }
          tags.push(temp);
        }

  
        var item = {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          short_description: product.short_description,
          price: product.price,
          featured: product.featured,
          images: images,
          categories: categories,
          tags: tags
        }
        products.push(item);
      }
      res.json(products);
    })
    .catch(err => {
      console.log(err);
      return res.status(500).json(err);
    })
  })
  .catch(error => {
    return res.json(error);
  })
})

//------------------------------------
//
// Retrieve featured products
//
//------------------------------------


app.get("/featured", (req, res) => {
  api.get("products", {
    featured: true,
    per_page: req.query.per_page != "" ? req.query.per_page : 3, //if not specified retrieve 3 featured products
    stock_status: "instock",
  })
})

//------------------------------------
//
// Retrieve product categories
//
//------------------------------------

app.get("/categories", (req, res) => {
  api.get("products/categories", {
    per_page: 100
  }).then(response => {
    return res.json(response.data);
  })
})

//------------------------------------
//
// Log in a user
//
//------------------------------------

app.post("/login", (req, res) => {
  console.log(req.body);
  let username = req.body.username;
  let password = req.body.password;

  axios({
    method: 'post',
    url: store_url + '/wp-json/jwt-auth/v1/token',
    data:{
      username: username,
      password: password
    },
  }).then(response => {
    let data = {
      statusCode: response.data.statusCode,
      jwt: response.data.data.token
    }
    //console.log('[Token] %s: %s\n', username, data.jwt);
    return res.json(data);
  })
  .catch(error => {
    console.log(error);
    return res.status(500).send(error);
  })
})

//------------------------------------
//
// Create an order
//
//------------------------------------
app.post("/order", (req, res) => {

  console.log(req.body);

  let cart_items = JSON.parse(req.body.cart);
  cart_items = cart_items.cart;
  if(cart_items == undefined || cart_items.length <= 0){
    return res.status(500).send("Error with cart data.");
  }

  var token = req.header('Authorization');
  console.log("Token: " + token);
  axios({
    method: 'get',
    url: store_url + '/wp-json/wp/v2/users/me',
    headers: {
      'Authorization': token,
      'Content-Type' : 'application/json; charset=utf-8',
    }
  })
    .then(response => {
      console.log("Yes");
      let user_id = response.data.id;

      api.get("customers/" + user_id)
        .then((customer_data) => {
          console.log("User: " + customer_data.data.id);
          customer_data = customer_data.data;
          let order_data = JSON.parse(JSON.stringify(order_template));
          order_data = order_data.order_template;
          if(customer_data.shipping.first_name == "" || customer_data.billing.first_name == ""){
            return res.status(500).send("Invalid shipping / billing information");
          }
          else{
            delete order_data.billing;
            delete order_data.shipping;
            order_data.billing = customer_data.billing;
            order_data.shipping = customer_data.shipping;

            console.log(cart_items);

            delete order_data.line_items;
            order_data.line_items = cart_items;

            api.post("orders", order_data)
              .then((order_created) => {
                order_created = order_created.data;
                let update_data = {
                  customer_id: customer_data.id,
                  status: "processing"
                }
                api.put("orders/" + order_created.id, update_data)
                  .then((order_updated) => {
                    order_updated = order_updated.data;
                    console.log("Successfully updated order #" + order_created.id);
                    return res.json(order_updated);
                  })
                  .catch((error) => {
                    console.log("Error updating order #" + order_created.id + ":\n" + error.response);
                    api.delete("orders/" + order_created.id, {
                      force: true
                    })
                      .then((order_deleted) => {
                        order_deleted = order_deleted.data;
                        console.log("Deleted order #" + order_deleted.id);
                      })
                      .catch((error) => {
                        console.log("Error deleting order #" + order_created.id + "\n" + error.response);
                      })
                      
                    return res.status(500).send("Error processing order.");
                  });
              })
              .catch((error) => {
                console.log(error.response);
                return res.status(500).send("Error creating order.");
              });
          }
        })
        .catch((error) => {
          console.log(error.response);
          return res.status(500).send("Error getting customer data.");
        });
    })
    .catch((error) => {
      console.log("Error authorizing user: \n" + error.response);
      return res.status(500).send("Error authorizing user.");
    });
})