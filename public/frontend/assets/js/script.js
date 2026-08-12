// Prevent right-click context menu
// document.addEventListener('contextmenu', function(event) {
//     event.preventDefault(); // Prevent the default right-click behavior
// });

// Prevent certain key combinations associated with opening developer tools
// document.addEventListener('keydown', function(e) {
//     if (e.which == 123 || (e.ctrlKey && e.shiftKey && [73, 75, 67, 74].includes(e.which))) {
//         e.preventDefault();
//     }
// });


getCurrency(); 
    
  
var currencySign = '';
var currencyCode = '';
var thousand_separator = ',';
var no_of_decimal = 2;
    
function getCurrency(){
    
    $.ajax({
        url: api_url + '/app-configuration',
        method: 'GET',
        dataType: 'json',
        success: function(res) {

         localStorage.setItem('currency_code', res.currency.currency_code);
         currencySign = res.currency.currency_symbol;
         currencyCode = res.currency.currency_code
         thousand_separator = res.currency.thousand_separator; 
         no_of_decimal  = res.currency.no_of_decimal;
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
}

function convertAmount(amount) {
    // amount = parseFloat(amount); 
    currencyCode = localStorage.getItem('currency_code');
    var formattedAmount = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: no_of_decimal,
        maximumFractionDigits: no_of_decimal
    }).format(amount);

    return formattedAmount;
}

function getTax(amount, callback) {
    $.ajax({
        url: api_url + '/branch-configuration',
        method: 'GET',
        dataType: 'json',
        success: function(res) {
            var calculationHtml = '';
            var totalAmount = parseFloat(amount);
            
            if (res.status && res.data.tax && res.data.tax.length > 0) {
                localStorage.setItem('tax', JSON.stringify(res.data.tax));
    
                $.each(res.data.tax, function(index, value) { 
                    var type = value.type == 'fixed' ? convertAmount(value.percent) : value.percent + '%';
                    var taxAmount = value.type == 'fixed' ? value.percent : ((value.percent / 100) * amount);
                    
                    totalAmount += parseFloat(taxAmount); 
                    calculationHtml += `<p class=""> ${value.name} (${type}) : <span>${convertAmount(taxAmount)}</span></p>`;
                });
            }

            callback({
                totalAmount: totalAmount,
                calculationHtml: calculationHtml,
                taxArray: res.data.tax
            });
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
}

function getBookingTotal(amount, time_slot = '', callback) {
    // Check if the callback is provided and is a function
    if (typeof callback !== 'function') {
        console.error('Callback provided to getBookingTotal is not a function:', callback);
        return;
    }

    $.ajax({
        url: api_url + '/get-booking-total',
        method: 'GET',
        data: { 'sub_total': amount, 'time_slot': time_slot },
        dataType: 'json',
        success: function(res) {
            var calculationHtml = '';
            var totalAmount = 0;
            var taxArray = null;

            if (res.status) {
                calculationHtml += `<li class="result-list"> <span class="rooms"> Sub Total </span>  <span class="value-count">${convertAmount(res.data.sub_total)}</span></li>`;
                calculationHtml += `<li class="result-list"> <span class="rooms"> Convenience Fee (${res.data.convience_fee}) </span>  <span class="value-count">${convertAmount(res.data.convience_fee)}</span></li>`;
                calculationHtml += `<li class="result-list"> <span class="rooms"> GST (${res.data.tax}%) </span> <span class="value-count">${convertAmount(res.data.tax_amount)}</span></li>`;
                calculationHtml += `<li class="result-list"> <span class="rooms"> Day and Night Charges </span> <span class="value-count">${convertAmount(res.data.additional_charge)}</span></li>`;
                calculationHtml += `<li class="result-list"> <span class="rooms"> Grand Total </span> <span class="value-count">${convertAmount(res.data.grand_total)}</span></li>`;
                totalAmount = res.data.grand_total;

                if (res.data.tax_array) {
                    taxArray = res.data.tax_array;
                }
            }

            console.log(res.data.grand_total);

            // Call the callback with the result data
            callback({
                totalAmount: totalAmount,
                calculationHtml: calculationHtml,
                taxArray: taxArray
            });
                        // Set the grand total on the success page
            document.getElementById('grand_total').innerText = `${convertAmount(res.data.grand_total)}`;

        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
}




function handleBookingTotalResponse(response) {
    // Handle the response from getBookingTotal here
    console.log('Total Amount:', response.totalAmount);
    console.log('Calculation HTML:', response.calculationHtml);
    console.log('Tax Array:', response.taxArray);

    // Update the DOM with the calculationHtml
    document.getElementById('calculation_checkout').innerHTML = response.calculationHtml;
    document.getElementById('total_amount').value = response.totalAmount;
}









// this function for click on category show subcategory popup
$(document).on("click",".click_category",function(e) {
    e.preventDefault();
    
    var category_banner_img = $(this).attr('data-banner-image');
    
    var category_title = $(this).attr('data-name');
    
    var category_id = $(this).attr('data-category_id');
    
    $('#category_banner_img').attr('src' , category_banner_img);
    
    $('.category_modal_title').text(category_title);
    
    $('#modal_subcategory').html("");
    get_subcategory(category_id , category_title);
  
    $('#categoryModal').modal('show');
});

// this function for get category 
function getCategory(category_id , category_title) {
    $.ajax({
        url: api_url + '/category-list',
        method: 'GET',
        data:{ category_id : category_id},
        dataType: 'json',
        beforeSend: function() {
            $('#home_category').html(ajax_loader.repeat(4));
        },
        success: function(res) {
            if (res.data && res.data.length > 0) { 
                var html = `<div class="row margin-top-20">`;
                var header_category = '';
                
                $.each(res.data, function(index, value) {
                    // var category_id = value.id; 
                    var service_url = web_url + '/service/' + value.id;
                    
                    html += `<div class="col-xl-2 col-6 col-lg-3 col-sm-6 col-md-4 margin-top-30 category-child">
                                <div class="single-category style-02 wow fadeInUp" data-name="${value.name}" data-category_id="${value.id}" data-banner-image="${value.banner_image}" style="cursor: pointer;">
                                    <div class="icon">
                                        <img src="${value.category_image}" alt>
                                    </div>
                                    <div class="category-contents">
                                        <h4 class="category-title"><a href="${service_url}">${value.name}</a></h4>
                                    </div>
                                </div>
                            </div>`;
                    
                    header_category += `<li><a href="${service_url}" class="" data-name="${value.name}" data-category_id="${value.id}" data-banner-image="${value.banner_image}" style="cursor: pointer;">${value.name}</a></li>`;
                });

                html += `</div>`;

                $('#home_category').html(html);
                $('#header-category').html(header_category);
                $('#mobile-category').html(header_category);
                $('#category_list').html(header_category);
                
            } else {
                $('#home_category').html('<p>No categories found</p>');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error fetching data:', error);
            $('#home_category').html('<p>Error fetching categories</p>');
        }
    });
}

// this function for product  category
function getShopCategory(category_id, category_title) {
    $.ajax({
        url: api_url + '/shop-category-list',
        method: 'GET',
        data: { category_id: category_id },
        dataType: 'json',
        beforeSend: function() {
            $('#shop_category').html(ajax_loader.repeat(4));
        },
        success: function(res) {
            if (res.data && res.data.length > 0) { 
                var html = `<div class="row margin-top-20">`;
                var header_category = '';
                
                $.each(res.data, function(index, value) {
                    var product_url = web_url + '/product/' + value.id;
                    
                    html += `<div class="col-xl-2 col-6 col-lg-3 col-sm-6 col-md-4 margin-top-30 category-child">
                                <div class="single-category style-02 wow fadeInUp" data-name="${value.name}" data-category_id="${value.id}" data-banner-image="${value.banner_image}" style="cursor: pointer;">
                                    <div class="icon">
                                        <img src="${value.category_image}" alt>
                                    </div>
                                    <div class="category-contents">
                                        <h4 class="category-title"><a href="${product_url}">${value.name}</a></h4>
                                    </div>
                                </div>
                            </div>`;
                    
                    header_category += `<li><a href="${product_url}" class="" data-name="${value.name}" data-category_id="${value.id}" data-banner-image="${value.banner_image}" style="cursor: pointer;">${value.name}</a></li>`;
                });

                html += `</div>`;

                $('#shop_category').html(html);
                $('#header-category').html(header_category);
                $('#mobile-category').html(header_category);
                $('#category_list').html(header_category);
                
            } else {
                $('#shop_category').html('<p>No categories found</p>');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error fetching data:', error);
            $('#shop_category').html('<p>Error fetching categories</p>');
        }
    });
}


// this function for get subcategory by category 
function get_subcategory(category_id , category_title){
    
    if (category_id) {
      $.ajax({
        url: api_url + '/category-list',
        method: 'GET',
        data:{ category_id : category_id},
        dataType: 'json',
        beforeSend: function() {
            $('#modal_subcategory').html('');
            
        },
        success: function(res) {
               $('#modal_subcategory').html('');
            if (res.data && res.data.length > 0) { 
                var html = ``;
                
    
                $.each(res.data, function(index, value) {
                    console.log(res.data);
                    
                    var service_url = web_url + '/service/'+category_id + '/' + value.id;
                    var additionalContent = '';

                    if (value.slug.indexOf("classic") !== -1) {
                        
                        additionalContent+=`<p class="badge badge-secondary " >ECONOMICAL</p>`;
                        
                         additionalContent += (category_title.indexOf("Women") !== -1) ? '<p style="color:#000;">VLCC | RICHELON </p>' : '';
                    } else {
                        
                       additionalContent+=`<p class="badge badge-secondary" >PRIME</p>`;
                        
                        additionalContent += (category_title.indexOf("Women") !== -1) ? '<p style="color:#000;"> LOREAL | RICA | O3</p>' : '';
                    }

                    html += `<div class="mod">
                              <a href="${service_url}">
                                <div class="row">
                                    <div class="col-4">
                                        <div class="img-k">
                                            <img src="${value.category_image}" alt="">
                                        </div>
                                    </div>
                                    <div class="col-8">
                                        <h1>${value.name}</h1>
                                         ${additionalContent}
                                    </div>
                                </div>
                              </a>     
                            </div>`;
                    
                });

                $('#modal_subcategory').html(html);
            }else {
            $('#modal_subcategory').html('No SubCategory found');
            }
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
    }
    
}

// this function for get Featured Services

function getFeaturedServiceList() {
   
    $.ajax({
        url: api_url + '/service-list',
        method: 'GET',
        data:{ featured :1 },
        dataType: 'json',
        success: function(res) {

            if (res.data && res.data.length > 0) { 
                var html = `<div class="row margin-top-20">`;
                var serviceList = '';
                
                
                $.each(res.data, function(service_list, value) {
                     var multistep_url = web_url + '/service_details/'+ value.id ;
                     
                   var  steps = JSON.stringify(value.step);
                    html += `<div class="col-xl-3 topz col-6 col-sm-6 col-md-6 margin-top-30">
                    <div class="single-service service-two style-03 service-padding section-bg-2 wow fadeInUp " data-wow-delay=".2s">
                        <a href="${multistep_url}" class="service-thumb tok service-detail-btn"
                         data-steps='${steps}' data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}">
                            <img src="${value.service_image}" id="serveImg" alt>
                            <div class="award-icons style-02">
                                <i class="las la-award"></i>
                            </div>
                        </a>
                        <div class="services-contents content-padding-reverse " id="services-data">
                             
                            <h4 class="common-title-two hover-color-three mt-4 service-detail-btn"
                         data-steps='${steps}' data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}"> <a href="#" class="over"> ${value.name}</a> </h4>
                            <p class="common-para text-black" title="${value.description}"> ${value.description !== null ? value.description.substring(0, 30) : ''}</p>
                            <div class="service-price-wrapper mt-4">
                                <div class="service-price style-02">
                                    <span class="prices style-02 color-3" id="price-items">${ convertAmount(value.default_price) }</span>
                                </div>
                                <div class="view-detailsBtn">
                                <a href="${multistep_url}" id="view-details" class="service-detail-btn" data-steps="${steps}" data-id="${value.id}" data-title="${value.name}" data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}"style="color:rgb(170, 43, 87);">View Details</a></div>
                                <div class="btn-wrapper" id="btnWrap">
                                
                                
                                    <a href="javascript:void(0)" class="cmn-btn btn-outline-light btn-medium add-service-btn" data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}"> <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16" >
  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
</svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
                });
                
                

                html += `</div>`;

                $('#serviceList').html(html);
            }
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
    
}


// product list

function convertAmount(price) {
        return parseFloat(price).toFixed(2);
    }

    // function getProductList(product_id, quantity, user_id) {
    //     $.ajax({
    //         url: api_url + '/shop-product-list',
    //         method: 'GET',
    //         data: { featured: 1 },
    //         dataType: 'json',
    //         success: function(res) {
    //             console.log("API Response:", res);

    //             if (res.status && res.data.length > 0) {
    //                 let html = '';

    //                 $.each(res.data, function(index, value) {
    //                     const multistep_url = web_url + '/product_details/' + value.id;
    //                     const productImage = value.product_image;

    //                     html += `
    //                     <div class="col-md-4 col-sm-6 col-lg-3 mb-4">
    //                         <div class="prod-box position-relative w-100">
    //                             <div class="prod-img brd-rd5 position-relative overflow-hidden w-100">
    //                                 <img class="img-fluid w-100" src="${productImage}" alt="${value.name}">
    //                                 <a class="thm-bg z1 brd-rd5 text-center position-absolute add-to-cart-link"
    //                                   href="#" title=""
    //                                   data-id="${value.id}"
    //                                   data-quantity="${value.quantity || 1}"
    //                                   data-product_image="${productImage}">
    //                                   <i class="fas fa-shopping-cart"></i>
    //                                 </a>
    //                             </div>
    //                             <div class="prod-info position-relative w-100 p-2">
    //                                 <span class="price z1 scndry-bg rounded-pill position-absolute text-center px-2 py-1">
    //                                     <small>â¹</small>${convertAmount(value.default_price)}
    //                                 </span>
    //                                 <h3 class="mb-0 mt-4">
    //                                     <a href="${multistep_url}" title="${value.name}">${value.name}</a>
    //                                 </h3>
    //                                 <span class="thm-clr d-block">${value.category || 'Chess'}</span>
    //                             </div>
    //                         </div>
    //                     </div>`;
    //                 });

    //                 $('#productList .products').html(html);

    //             } else {
    //                 $('#productList .products').html('<p>No featured products available.</p>');
    //             }
    //         },
    //         error: function(error) {
    //             console.error('Error fetching data:', error);
    //             $('#productList .products').html('<p>Error loading featured products. Please try again later.</p>');
    //         }
    //     });
    // }







    function fetchFilteredProducts() {
        var selectedCategories = [];
        $('input[name="category_id[]"]:checked').each(function() {
            selectedCategories.push($(this).val());
        });

        $.ajax({
            url: web_url + '/product_list', // Update this URL to your route
            type: 'GET',
            data: {
                category_id: selectedCategories,
                ajax: true
            },
            success: function(response) {
                $('#productList .row').html(response);
            },
            error: function(xhr) {
                console.error(xhr.responseText);
            }
        });
    }

    

    // Fetch products initially if needed
    











// Function to reels 

// this function for get Featured Services
function getReelsServiceList() {
    $.ajax({
        url: api_url + '/video-list',
        method: 'GET',
        data: { featured: 1 },
        dataType: 'json',
        success: function(res) {
            if (res.data && res.data.length > 0) {
                var html = `<div class="row ">`;
                $.each(res.data, function(video_list, value) {
                    var thumbnail = ''; 
                    if (value.thumbnail) {
                        thumbnail = `<img src="${value.thumbnail_image}" style="width: 100px; border-radius: 10px; height: 100px;">`;
                    }
                    var video = ''; 
                    if (value.video) {
                        
                        video = `<video class="vw"  controls style="display: none;">
                            <source src="${value.video}" type="video/mp4">
                                </video>`;
                            }
                    html += `<div class="col-xl-2 topz col-md-6 col-6 col-sm-6 margin-top-30">
                                <div class="tg1 single-service video service-two style-03 service-padding section-bg-2 wow fadeInUp " data-wow-delay=".2s">
                                    <a href="#" class="service-thumb tok1 play-icon-btn" 
                                    data-thumbnail-src="${value.thumbnail_image}">
                                    <img class="imgReel" src="${value.thumbnail_image}" style="aspect-ratio: 1/2 !important;">
                                       <div class="play-icon"></div> 
                                    </a>
                                    ${video}
                                    
                                </div>
                            </div>`;
                });
                html += `</div>`;
                $('#reelsList').html(html);

                
                $('.play-icon-btn').click(function(e) {
                 e.preventDefault();
                var $service = $(this).closest('.single-service');
                var $video = $service.find('video');
                var $thumbnail = $service.find('img');
                
                $video.toggle();
                $thumbnail.toggle();
                
                    if ($video.is(':visible')) {
                        $video.get(0).play();
                    } else {
                        $video.get(0).pause();
                    }
});
// Autoplay video on page load if needed
    $('.vw').each(function() {
        if ($(this).is(':visible')) {
            $(this).get(0).play();
        }
    });
            }
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
}






// Function to fetch and display banners in a carousel
function get_banner(banner_for) {
    if (banner_for) {
        $.ajax({
            url: api_url + '/slider-list',
            method: 'GET',
            data: { banner_for: banner_for },
            dataType: 'json',
            success: function(res) {
                $('#banner_' + banner_for).html('')
                if (res.data && res.data.length > 0) {
                    var html = `<div id="carousel-banner_${banner_for}" class="carousel slide" data-ride="carousel" >
                                    <ol class="carousel-indicators">`;
                    $.each(res.data, function(index, value) {
                        var active = index == 0 ? 'active' : '';
                        html += `<li data-target="#carousel-banner_${banner_for}" data-slide-to="${index}" class="${active}"></li>`;
                    });
                    html += `</ol>
                            <div class="carousel-inner tk" role="listbox">`;
                    $.each(res.data, function(index, value) {
                        var active = index == 0 ? 'active' : '';
                        var service_url = web_url + '/service/'+value.link_id + '/' + value.sub_id;
                        html += `<div class="carousel-item xd ${active}">
                        <a href="${service_url}">
                                    <img   class="d-block w-100 slider-image" src="${value.slider_image}" alt="slide">
                                    </a>
                                </div>`;
                    });
                    html += `</div>
                                <a class="carousel-control-prev" href="#carousel-banner_${banner_for}" role="button" data-slide="prev">
                                    <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                                    <span class="sr-only">prev</span>
                                </a>
                                <a class="carousel-control-next" href="#carousel-banner_${banner_for}" role="button" data-slide="next">
                                    <span class="carousel-control-next-icon" aria-hidden="true"></span>
                                    <span class="sr-only">next</span>
                                </a>
                            </div>`;
                    $('#banner_' + banner_for).html(html);
                    $(`#carousel-banner_${banner_for}`).carousel({
                        interval: 1000, // Adjust the interval as needed
                        wrap: true,
                        keyboard: true
                    });
                }
            },
            error: function(xhr, status, error) {
                console.error('Error fetching data:', error);
                // Handle error display or logging appropriately
            }
        });
    }
}


// this function for servicelist 
function getSearchServiceList(category_id ,sub_category_id="", child_category_id="") {
    if (category_id) {
    $.ajax({
        url: api_url + '/service-list',
        method: 'GET',
        data:{ category_id:category_id ,subcategory_id:sub_category_id , childcategory_id:child_category_id,},
        dataType: 'json',
        success: function(res) {

            var html = `` ; 
            if (res.data && res.data.length > 0) { 
                html += `<div class="row margin-top-20">`;
                var services = '';
                
                $.each(res.data, function(service_list, value) {
    
                     var multistep_url = web_url + '/service-booking/'+ value.id ;
                     var steps = JSON.stringify(value.step);
                    
                    html += `<div class="col-lg-4 col-md-6 col-6 col-sm-6 margin-top-30 serviceListMargin" id="details">
                    <div class="single-service no-margin wow fadeInUp "
                        data-wow-delay=".2s" data-steps='${steps}' data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}">
                        <a href="#" class="service-thumb tok service-detail-btn" id="serveCatImg"
                         data-steps='${steps}' data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}">
                            <img src="${value.service_image}" alt>
                            <div class="award-icons">
                                <i class="las la-award"></i>
                            </div>
                        </a>
                        <div class="services-contents">
                            <!-- <ul class="author-tag">
                                <li class="tag-list">
                                    <a href="javascript:void(0)">
                                        <div class="authors">
                                            <div class="thumb">
                                                <img src="{{asset('frontend/assets/')}}/img/service/author.jpg" alt>
                                                <span class="notification-dot"></span>
                                            </div>
                                            <span class="author-title"> Rajia Akter </span>
                                        </div>
                                    </a>
                                </li>
                                <li class="tag-list">
                                    <a href="javascript:void(0)">
                                        <span class="icon"> <i class="las la-star"></i> </span>
                                        <span class="reviews"> ${value.duration_min}</span>
                                    </a>
                                </li>
                            </ul> -->
                            <h4 class="tw common-title-two service-detail-btn"
                         data-steps='${steps}' data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}"><a  href="#" id="nameCate">${value.name}</a> </h4>
                            <p class="common-para paraDesc descProduct" id="paraDesc" title="${value.description}"> ${value.description !== null ? value.description.substring(0, 30) : ''}</p>
                            <div class="service-price mt-3 serveNamePrice">
                                <span class="starting startName"> Starting at </span>
                                <span class="prices color-3 priceCate">${convertAmount(value.default_price) }</span>
                            </div>
                             <div class="detailsView" id="viewDetail">
                                <a href="${multistep_url}"  class="service-detail-btn" data-steps="${steps}" data-id="${value.id}" data-title="${value.name}" data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}"style="color:rgb(170, 43, 87);">View Details</a>
                                </div>
                            <div class="btn-wrapper btnAddcategory mt-4">
                                <a href="javascript:void(0)" class="cmn-btn btn-appoinment btn-outline-1 add-service-btn plusServeAdd"  data-id="${value.id}" data-title="${value.name}"  data-service_image="${value.service_image}" data-default_price="${value.default_price}" data-description="${value.description}" data-duration_min="${value.duration_min}" >
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16" >
  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>`;
                });

                html += `</div>`;

            }else {
                html = `<div class="text-center">No Service Found</div>`;
            }
            
            $('#searchServiceList').html(html);
            
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
    }   
}

// this function for Category detail
function getCategoryDetail(category_id) {
    if (category_id) {
    $.ajax({
        url: api_url + '/category-detail',
        method: 'POST',
        data:{ category_id : category_id , '_token' : csrf_token,
        },
        dataType: 'json',
        success: function(res) {

            if (res.data) { 
              var image = `<img src="${res.data.banner}" alt="">`;
        
                $('#category-detail-image').html(image);
            }
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
    }
}



// product detail

function getShopCategoryDetail(category_id) {
    if (category_id) {
        $.ajax({
            url: api_url + '/shop-category-detail',
            method: 'POST',
            data: { 
                category_id: category_id, 
                '_token': csrf_token 
            },
            dataType: 'json',
            success: function(res) {
                if (res.data) { 
                    var image = `<img src="${res.data.banner}" alt="">`;
                    $('#shop-detail-image').html(image);
                }
            },
            error: function(error) {
                console.error('Error fetching data:', error);
            }
        });
    }
}



// this function for Chaild-Category 
function getChildCategory(sub_category_id ,category_id="") {
    if (sub_category_id) {
    $.ajax({
        url: api_url + '/childcategory-list-by-sub-category',
        method: 'POST',
        data:{ sub_category_id: sub_category_id , '_token' : csrf_token ,category_id:category_id },
        dataType: 'json',
        success: function(res) {
            if (res.data && res.data.length > 0) { 
                var html = `<div class="row">`;
                var child_category = '';
                $.each(res.data, function(index, value) {
                    
                    html += `<div class="col-xl-3 col-md-4 col-6 col-sm-6 margin-top-30 category-child child-category-click" data-id="${value.id}" style="cursor:pointer;">
                              <div class="single-category style-02 wow fadeInUp" data-wow-delay=".2s">
                                <div class="icon">
                                    <img src="${value.category_image}" alt>
                                </div>
                        <div class="category-contents">
                           <h4 class="category-title"><a href="#details">${value.name}</a> </h4>
                       </div>
                 </div>
               </div>`;
                });

                html += `</div>`;
                $('#child-category').html(html);
            }else {
                $('#child-category').html('');
            }
            
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });
}else{
    $('#child-category').html(''); 
}

}

// service details page

function fetchServiceDetails(serviceId) {
    $.ajax({
        url: api_url + '/service-detail',
        method: 'POST',
        data: { 
            service_id: serviceId,
            '_token': csrf_token 
        },
        dataType: 'json',
        success: function(res) {
            var html = `` ; 
            if (res.data && res.data.length > 0) { 
                html += `<div class="service-details-wrapper">`;
                
                $.each(res.data, function(index, value) {
                    var multistep_url = web_url + '/service-detail/' + value.id;

                    html += `<div class="service-details-inner">
                                <div class="details-thumb">
                                    <img src="${value.feature_image}" alt="">
                                </div>
                                <ul class="details-tabs tabs margin-top-55">
                                    <li data-tab="tab1" class="list active">
                                        Overview
                                    </li>
                                    <li class="list" data-tab="tab2">
                                        About Seller
                                    </li>
                                    <li class="list" data-tab="tab3">
                                        Review
                                    </li>
                                </ul>
                                <div class="tab-content-item active" id="tab1">
                                    <div class="details-content-tab padding-top-10">
                                        <p class="details-tap-para">${value.description !== null ? value.description.substring(0, 30) : ''}</p>
                                    </div>
                                    <!-- Insert more content here as needed -->
                                </div>
                                <!-- Insert more tab-content-items here as needed -->
                            </div>`;
                });

                html += `</div>`;
            } else {
                html = `<div class="text-center">No Service Found</div>`;
            }

            $('#detailsservice').html(html);
        },
        error: function(xhr, status, error) {
            // Handle errors
            console.error(error);
        }
    });
}
// product details
function getProductDetail(productId) {
    $.ajax({
        url: api_url + '/shop-product-detail',
        method: 'GET',
        data: { 
            product_id: productId,
            '_token': csrf_token 
        },
        dataType: 'json',
        success: function(res) {
            var html = `` ; 
            if (res.data) { 
                html += `<div class="row mrg30">`;
                var product  = res.data;
                         html += `<div class="col-md-12 col-sm-12 col-lg-11" style="margin: auto;">
                                    <div class="product-gallery images">
                                            <div class="prod-detail w-100">
                                                <div class="prod-detail-info-wrap d-flex flex-wrap w-100">
                                                     <div class="prod-detail-img brd-rd10 overflow-hidden"><img class="img-fluid w-100" src="${product.product_image}" alt="product-img"></div>
                                               
                                                         <div class="prod-detail-info">
                                                         
                                                
                                              <h2 class="mb-0">${product.name}</h2>
                                
                                    
                                                <p class="price mb-25">
                                                    <span class="Price-amount amount">
                                                        
                                                        <ins>
                                                            
                                                        <div class="price-stock d-flex flex-wrap justify-content-between align-items-center w-100">
                                                    <span class="price scndry-clr d-inline-block"><ins>${ convertAmount(product.default_price) }</ins></span>
                                                  
                                                </div>
                                                    </ins>
                                                    </span>
                                                </p>
                                              
                                                <div class="product-details__short-description">
                                                <p>${product.description !== null ? product.description : '' }</p>
                                                </div>
                                               
                                                
                                                
                                                <form class="cart w-100 d-flex flex-wrap align-items-center" href="#">
                                                    <div class="quantity"><label class="screen-reader-text">Quantity :</label>
                                                        <input type="number"class="input-text" value="${product.quantity}" title="Qty" min="1" onchange="updateCart(${product.id}, this.value)">
                                                    </div>
                                                 
                                                </form>
                                                
                                                <div class="cart_button ttm-btn ttm-btn-bgcolor-black ttm-btn-shape-round ttm-textcolor-white add-to-cart-btn"  data-id="${product.id}" data-quantity="${product.quantity}">
                                                        <a href="#" class="add-to-cart-link thm-btn v2 tok scndry-bg brd-rd5 d-inline-block position-relative overflow-hidden">Add to cart</a>
                                                </div>
                                            </div>
                                        </div>
                                       
                                    </div>
                                </div>
                            </div>
                            
                            `;
            

                html += `</div>`;
            } else {
                html = `<div class="text-center">No Product Found</div>`;
            }
            
            // console.log(html);

            $('#productDetail').html(html);
        },
        error: function(xhr, status, error) {
            // Handle errors
            console.error(error);
        }
    });
}



function getServiceStep(service_id) {
    $.ajax({
        url: api_url + '/service-steps',
        method: 'GET',
        data: { 
            service_id: service_id,
        },
        dataType: 'json',
        success: function(res) {
            $('#service_steps').html(''); 
            var html = `<div class="container"> 
                           <h6 class="abt">About The Process</h6>`;
            if (res.data && res.data.step.length > 0) {
                res.data.step.forEach(function(step, index) {
                    
                    var step_image = (step.full_url !== 'null' && step.full_url !== null) ? `<div class="set_img"><img class="w-100 shadow" src="${step.full_url}" /> </div>` : '';
                    html += `<div class="step completed">
                      <div class="v-stepper">
                        <div class="circle"><span class="one">${index+1}</span></div>
                        <div class="line"></div>
                      </div>
                
                      <div class="content">
                        <h6 class="set">${step.step}</h6>
                        ${step.description}
                        
                        ${step_image}
                      </div>
                    </div>
                    `;
                });
            }
            html += `</div>`;
            $('#service_steps').html(html); 
        }
    });
}



$(document).on("click", ".service-detail-btn", function(e) {
    e.preventDefault();

    var service_id = $(this).attr('data-id');
    // Set service details
    $('.service_title-d').text($(this).data('title'));
    $('#service_title_d').text($(this).data('title'));
    $('#service_image_d').attr('src', $(this).data('service_image'));
    $('#service_desc_d').text($(this).data('description'));
    $('#service_price_d').text(convertAmount($(this).data('default_price')));

    // Call getServiceStep function
    getServiceStep(service_id);
    
    $('#service-detial-add-btn').html(`<div class="btn-wrapper">
                <a href="javascript:void(0)" class="cmn-btn btn-outline-light btn-medium add-service-btn" data-id="${service_id}" data-title="${$(this).data('title')}"  data-service_image="${$(this).data('service_image')}" data-default_price="${$(this).data('default_price')}" data-description="${$(this).data('description')}" data-duration_min="${$(this).data('duration_min')}"> Add
                </a>
            </div>`);

    // Show modal  
    $('#serviceDetailModal').modal('show');
});


// Add to cart function
function addToCart(product_id, quantity, user_id) {
    $.ajax({
        url: api_url + '/add-to-cart',
        method: 'POST',
        data: {
            '_token': csrf_token,
            'product_id': product_id,
            'quantity': quantity,
            'user_id': user_id // Include user_id if necessary
        },
        dataType: 'json',
        success: function(response) {
            if (response.status) {
                // Display a success toast message
                new bs5.Toast({
                    body: response.message,
                    className: 'border-0 bg-success text-white custom-toast',
                    btnCloseWhite: true,
                    pos: 'bottom-right'
                }).show();
                
                
                
                // Reload the page after a brief delay
                setTimeout(function() {
                    location.reload();
                }, 500);
                
                // Log the success message to the console
                console.log('Product added to cart:', response.message);
                
                // Update cart count
                getCartCount(); 
                
            } else {
                console.log('Error:', response.message);
            }
        },
        error: function(error) {
            console.error('Error adding product to cart:', error);
        }
    });
}


// Function to fetch and display cart items
function getCartCount() {
    $.ajax({
        url: api_url + '/get-cart-list',
        method: 'GET',
        data: {
            '_token': csrf_token,
        },
        dataType: 'json',
        success: function(res) {
            if (res.status && res.data) {
                console.log("Cart API Response:", res); // ð Full API response
                // Clear existing cart items
                $('#product-cart tbody').empty();

                // Loop through each product in the response and add it to the cart
                res.data.items.forEach(function(product) {
                    addProductElement(product);  // Ensure this function displays the default_price
                });

                // Update the cart subtotal
                updateCartTotal(res.data.sub_total);  // Single subtotal for all items

                // Update the cart count
                const count = res.data.items.length;
                $('.cart-count1').text(count);
            } else {
                console.log('Error:', res.message);
                $('.cart-count1').text('0'); // Display zero if there's an error
            }
        },
        error: function(error) {
            console.error('Error fetching cart count:', error);
            if (error.responseText) {
                console.log('Response Text:', error.responseText); // backend à¤à¤¾ à¤ªà¥à¤°à¤¾ error à¤¦à¥à¤à¥
            }
            $('.cart-count1').text('0');
        }

    });
}

// Function to add a product to the cart
function addProductElement(product) {
    var productHtml = `
    <tr class="cart_item" id="product-${product.id}">
        <td class="product-remove">
            <a href="#" class="remove" onclick="removeProduct(${product.id})">Ã</a>
        </td>
        <td class="product-thumbnail">
            <a href="product-details.html">
                <img class="img-fluid" src="${product.product_image}" alt="product-img">
            </a>
        </td>
        <td class="product-name" data-title="Product">
            <a href="product-details.html">${product.name}</a>
        </td>
        <td class="product-price" data-title="Price">
            <span class="Price-amount">
                <span class="Price-currencySymbol">â¹</span>${product.default_price}
            </span>
        </td>
        <td class="product-quantity" data-title="Quantity">
            <div class="quantity">
                <input type="number" class="input-text" value="${product.quantity}" title="Qty" min="1" onchange="updateCart(${product.id}, this.value)">
            </div>
        </td>

        <td class="product-subtotal" data-title="Total">
            <span class="Price-amount">
                <span class="Price-currencySymbol">â¹</span>${product.default_price * product.quantity}
            </span>
        </td>
    </tr>
    `;

    // Append the product HTML to the product-cart container
    $('#product-cart tbody').append(productHtml);
}

// Call the function to fetch and display the cart data on page load
$(document).ready(function() {
   getCartCount();
});

// Function to remove a product from the cart
function removeProduct(id) {
    $.ajax({
        url: api_url + '/remove-cart', // Ensure the base URL is defined properly
        method: 'POST',
        dataType: 'json',
        data: {
            '_token': csrf_token,
            'product_id': id // Change 'id' to 'product_id' as expected by the backend
        },
        success: function(response) {
            if (response.status) {
                // Display a success toast message
                new bs5.Toast({
                    body: response.message,
                    className: 'border-0 bg-success text-white custom-toast',
                    btnCloseWhite: true,
                    pos: 'bottom-right'
                }).show();
                
                
                // Reload the page after a brief delay
                // setTimeout(function() {
                //     location.reload();
                // }, 500);
                // Successfully removed from the cart
                // Remove the product row from the table
                $('#product-' + id).remove();

                // Update the cart count and totals
                getCartCount();
            } else {
                console.log('Error:', res.message);
            }
        },
        error: function(error) {
            console.error('Error removing product from cart:', error);
        }
    });
}

// update cart
// Function to update cart quantity
function updateCart(productId, newQuantity) {
    $.ajax({
        url: api_url + '/update-cart',
        method: 'POST',
        dataType: 'json',
        data: {
            '_token': csrf_token,
            'product_id': productId,
            'quantity': newQuantity
        },
        success: function(response) {
            if (response.status) {
                // Successfully updated cart
                // Update the cart count and subtotal
                // Display a success toast message
                new bs5.Toast({
                    body: response.message,
                    className: 'border-0 bg-success text-white custom-toast',
                    btnCloseWhite: true,
                    pos: 'bottom-right'
                }).show();
                
                
                // Reload the page after a brief delay
                setTimeout(function() {
                    location.reload();
                }, 500);
                getCartCount();
            } else {
                console.log('Error:', res.message);
            }
        },
        error: function(error) {
            console.error('Error updating cart:', error);
        }
    });
}

// Function to update total cart amount on the page
function updateCartTotal(totalAmount) {
    $('#cart-subtotal').text('â¹' + totalAmount); // Ensure you have an element with the class 'cart-subtotal'
}


$(document).on("click", ".add-to-cart-btn", function(e) {
    e.preventDefault();

    // Retrieve the necessary data attributes from the button
    var product_id = $(this).attr('data-id'); 
    var quantity = $(this).attr('data-quantity');
    var product_image = $(this).attr('data-product_image');
    
    // Check if the user is authenticated (user_id should be defined)
    if (!user_id) {
        // If not authenticated, redirect to login page
        window.location.href = web_url + '/signin';
        return;
    }

    // If authenticated, call the addToCart function
    addToCart(product_id, quantity, user_id);
});

// Call the function with the service ID
    // Example AJAX request
function BookingList() {
    $.ajax({
        url: api_url + '/booking-list',
        method: 'GET',
        data: { '_token': csrf_token },
        dataType: 'json',
        success: function(res) {
            var NO_BOOKING = `<div class="text-center mt-4">No Booking Found</div>`;
            
            // Clear the content of all status lists
            $('#pending_list').html('');
            $('#confirmed_list').html('');
            $('#check_in_list').html('');
            $('#checkout_list').html('');
            $('#cancelled_list').html('');
            $('#completed_list').html('');
            
            if (res.data && res.data.length > 0) {
                var statuses = ['pending', 'confirmed', 'check_in', 'checkout', 'cancelled', 'completed'];
                
                // Iterate over each status
                for (var i = 0; i < statuses.length; i++) {
                    var status = statuses[i];
                    var bookingsWithStatus = res.data.filter(booking => booking.status === status);
                    
                    // If there are bookings with the current status, display them
                    if (bookingsWithStatus.length > 0) {
                        bookingsWithStatus.forEach(booking => {
                            var booking_url = web_url + '/booking-details/' + booking.id;
                            var service_image = booking.services.length > 0 ? booking.services[0].service_image : '';
                            var service_names = booking.services.map(service => service.service_name).join(', ');
                            var service_total = booking.services.reduce((total, service) => {
                                return total + (parseInt(service.quantity) * parseInt(service.service_price));
                            }, 0);
    
                          getTax(service_total, function(result) {
    var tax_percentage = (booking.payment && booking.payment.tax_percentage) ? booking.payment.tax_percentage : [];

    var grand_total = parseFloat(service_total);

    if (Array.isArray(tax_percentage) && tax_percentage.length > 0) {
        tax_percentage.forEach(function(tax) {
            console.log(tax.percent);
            var type = tax.type == 'fixed' ? convertAmount(tax.percent) : tax.percent + '%';
            var taxAmount = tax.type == 'fixed' ? tax.percent : ((tax.percent / 100) * service_total);

            grand_total += parseFloat(taxAmount);
        });
    }

    var desiredDate = booking.start_date_time; 

    var [bookingDate, bookingTime] = desiredDate.split(' ');
    var time = moment(bookingTime, "HH:mm:ss");
    var formattedTime = time.format("h:mmA");
    
    // Create a moment object for bookingDate
    var momentBookingDate = moment(bookingDate, "YYYY-MM-DD");
    
    // Format the bookingDate
    var formattedBookingDate = momentBookingDate.format("D MMM, YYYY ");
    
    var btn =  (booking.status=='pending' || booking.status=='confirmed') ? `<a href="javascript:void(0)" class="cmn-btn btn-bg-3 booking-status-update-btn" id="updateBooking" data-id="${booking.id}" data-status="cancelled" data-date="${ booking.start_date_time}" >Cancel Appointment</a>` : '';

    var html = `<div class="dashboard-order-single margin-top-40">
                    <div class="dashboard-thumb-flex">
                        <div class="thumb inn">
                            <img src="${service_image}" alt>
                        </div>
                        <div class="contents">
                            <h4 class="title"><a href="javascript:void(0)">${service_names}</a></h4>
                            
                            <div class="btn-wrapper margin-top-30" id="btnStatus">
                                <a href="javascript:void(0)" class="cmn-btn completed">${booking.status}</a>
                            </div>
                        </div>
                    </div>
                    <div class="single-oreder-request">
                        <h2 class="title color-three">${convertAmount(service_total)}</h2>
                        <span class="orders">${formattedBookingDate + ' ' + formattedTime}</span>
                    </div>
                    <div class="dashboard-request-cancel">
                        <div class="btn-wrapper">
                            ${btn}
                        </div>
                        <div class="dashboard-icons margin-top-30 dashViewDetail" style="margin-top: -55px;margin-left: 935px;">
                            <a href="${booking_url}"><span class="icon eye-icon">View Details</span></a>
                        </div>
                    </div>
                </div>`;

    $(`#${booking.status}_list`).append(html);
});

                        });
                    } else {
                        // If there are no bookings with the current status, display the "No Booking Found" message
                        $(`#${status}_list`).html(NO_BOOKING);
                    }
                }
            } else {
                // If no booking data is returned, display "No Booking Found" for all status lists
                $('#pending_list').html(NO_BOOKING);
                $('#confirmed_list').html(NO_BOOKING);
                $('#check_in_list').html(NO_BOOKING);
                $('#checkout_list').html(NO_BOOKING);
                $('#cancelled_list').html(NO_BOOKING);
                $('#completed_list').html(NO_BOOKING);
            }
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });  
}


$(document).on("click",".booking-status-update-btn",function(e) {
    e.preventDefault();
    
    var id = $(this).data('id');
    var status = $(this).data('status');
    
    $('#cancleyes').attr('onclick' , `booking_update(${id},'${status}')`);
    
    $('.change_schedule_btn').attr('data-booking_id' , `${id}`);
    
    $('.resude_btn').attr('data-date' , $(this).data('date'));
    
    $('#bookingStatusModal').modal('show');
    
});

// this function for booking update
function booking_update(id,status) {
    
    $.ajax({
        url: api_url + '/update-status',
        method: 'POST',
        data:{  status:status, '_token' : csrf_token ,id:id },
        dataType: 'json',
        success: function(res) {
            if (res.status) {
                BookingList();
                $('#bookingStatusModal').modal('hide');
            }else {
                console.log(res.message);
            }
            
            
        },
        error: function(error) {
            console.error('Error fetching data:', error);
        }
    });

}
$(document).on("click",".resude_btn",function(e) {
    e.preventDefault();
    
    var desiredDate = $(this).attr('data-date'); 
    
    var [bookingDate, bookingTime] = desiredDate.split(' ');
   
    $('.date-container .list').removeClass('active');
    $('.time-container .list').removeClass('active');

    $('.date-container .list').each(function() {
        var date = $(this).data('date');
        
        if (date === bookingDate) {
            // Add 'active' class to the current element
            $(this).addClass('active');
            
            // Add 'active' class to the closest parent with the class 'owl-item'
            $(this).closest('.owl-item').addClass('active');
            
            // Get the index of the parent element among its siblings
            var parentIndex = $(this).parent().index();
            
            // Trigger 'to.owl.carousel' event to move to the desired index
            $('.owl-carousel').trigger('to.owl.carousel', [parentIndex, 100]);
        }
    });


    
    var time = moment(bookingTime, "HH:mm:ss");
    var formattedTime = time.format("HH:mm");
    
    $('.time-container .list').each(function() {
        var time = $(this).data('time');
        console.log(formattedTime + ' time :' + time);
        if (time === formattedTime) {
            
            $(this).addClass('active');
        }
    });

    
    $('#bookingStatusModal').modal('hide');
    $('#rescheduleModal').modal('show');
    
});


$(document).on("click", ".category-child", function(e) {
    e.preventDefault();
    $('.category-child').find('.single-category').removeClass('active-category');
    $(this).find('.single-category').toggleClass("active-category");
});



     