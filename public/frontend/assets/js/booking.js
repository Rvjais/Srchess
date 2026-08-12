(function ($) {
   "use strict";

    var services = [];

    // Check if there's any data in local storage on page load
    var storedServices = localStorage.getItem('services');
    if (storedServices) {
        services = JSON.parse(storedServices);
    }

    // Function to update local storage with the current services array
    function updateLocalStorage() {
        localStorage.setItem('services', JSON.stringify(services));
    }

    // Function to add a new service
    function addService(newService) {
        services.push(newService);
        updateLocalStorage();
    }

    // Function to update the quantity of a specific service by its service_id
    function updateServiceQuantity(serviceId, newQuantity) {
        var serviceToUpdate = services.find(function(service) {
            return service.service_id === serviceId;
        });

        if (serviceToUpdate) {
            serviceToUpdate.quantity = newQuantity;
            updateLocalStorage();
        } 
    }

    // Function to remove a service by its service_id
    function removeService(serviceId) {
        var indexToRemove = services.findIndex(function(service) {
            return service.service_id === serviceId;
        });

        if (indexToRemove !== -1) {
            services.splice(indexToRemove, 1);
            updateLocalStorage();

        }
    }

    //  Add a new service
        $(document).on('click', ".add-service-btn", function () {
        var service_id = $(this).attr('data-id');
        var service_name = $(this).attr('data-title');
        var service_image = $(this).attr('data-service_image');
        var service_description = $(this).attr('data-description');
        var service_price = $(this).attr('data-default_price');
        var duration_min = $(this).attr('data-duration_min');
    
        var newService = {
            service_id: service_id,
            quantity: 1,
            service_price: service_price,
            duration_min: duration_min,
            service_name: service_name,
            service_description: service_description,
            service_image: service_image
        };
    
        // Check if the service already exists in the services array
        var serviceToUpdate = services.find(function(service) {
            return service.service_id === service_id;
        });
    
        if (serviceToUpdate) {
            // If the service already exists, update its quantity
            serviceToUpdate.quantity = parseInt(serviceToUpdate.quantity) + 1; // Reset quantity to 1
            updateLocalStorage(); // Update local storage
        } else {
            // If the service does not exist, add it to the services array
            addService(newService);
        }
    
        // Render the services after updating
        renderServices();
    
        $('#serviceDetailModal').modal('hide');
        // Show the modal
        $('#cart_modal').modal('show');
    });


    // Remove service with service_id 3
    $(document).on('click', ".remove-service-btn", function () {
        var service_id = $(this).attr('data-id');
        removeService(service_id);
        renderServices();
    });

   function addServiceElement(service) {
        var serviceHtml = `
        <div class="row mb-3">
            <div class="col-lg-6">
                <div class="img serviceimg" >
                    <img class="ts" src="${service.service_image}" alt="">
                </div>
            </div>
            <div class="col-lg-6">
                <h1 id="service_title">${service.service_name}</h1>
                <p id="service_desc">${service.service_description}</p>
                <p style="color: #702543; font-size: 18px;">Price : <span>${service.service_price}</span></p>
                <div class="pric mt-4">
                    <div class="row">
                        <div class="col-12">
                            <div class="mt-2 mb-2">
                                <p style="display: inline-block; color: #702543; font-size: 16px; margin-right: 1%;">QTY :</p>
                                <div class="value-button minus-btn " style="cursor:pointer;" data-id="${service.service_id}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash-lg" viewBox="0 0 16 16">
                                        <path fill-rule="evenodd" d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8" />
                                    </svg>
                                </div>
                                <input class="tt qty qty_${service.service_id}" type="number" id="number" value="${service.quantity}" />
                                <div class="value-button plus-btn " style="cursor:pointer;" data-id="${service.service_id}">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
                                        <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2" />
                                    </svg>
                                </div>
                                
                                <div class="value-button plus-btn remove-service-btn ml-3" style="cursor:pointer;" data-id="${service.service_id}">
                                    <i class="fa fa-times-circle" style="font-size:18px"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div> <hr> `;
        
        // Append the service element to the services container
        $('#services-container-dy-cart').append(serviceHtml);
    }
    
    // Function to render all services
    function renderServices() {
        $('#services-container-dy-cart').empty();
        
        // Loop through each service and add its element
        services.forEach(function(service) {
            addServiceElement(service);
        });
        
        if (services.length==0) {
            $('#services-container-dy-cart').html(`<div class="text-center">Cart is empty</div>`);
        }
        
        $('.cart-count').html(services.length);
    }
    
    function cartDelete() {
        localStorage.removeItem('services');
    }
    
    $(document).on('click', ".plus-btn", function (e) {
        e.preventDefault();
        // Get the input element
        var $input = $(this).parent().find('.tt');
        // Increment value
        $input.val(parseInt($input.val()) + 1);
        
        var id = $(this).attr('data-id');
        var qty = $('.qty_' + id).val();
        updateServiceQuantity(id, qty);
        renderServices();
    });

    // Event listener for minus button
    $(document).on('click', ".minus-btn", function (e) {
        e.preventDefault();
        // Get the input element
        var $input = $(this).parent().find('.tt');
        // Get current value
        var value = parseInt($input.val());
        // Ensure value doesn't go below 0
        
        if (value > 1) {
            // Decrement value
            $input.val(value - 1);
        }else {
            return ;
        }
        
        var id = $(this).attr('data-id');
        var qty = $('.qty_' + id).val();
        updateServiceQuantity(id, qty);
        renderServices();
    });
    
    $(document).on('click', '.close', function() {
      $(this).closest('.modal').modal('hide');
    });
   
   $(document).on('click', ".view-cart", function () {
       renderServices();
      $('#cart_modal').modal('show');
    });
    
    $(document).ready(function() {
      renderServices();
    });

})(jQuery);

