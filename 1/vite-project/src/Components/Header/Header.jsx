import React from 'react'
import './Header.css'
import { headerBooks } from '../../Data/Data'
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { Navigation, Pagination } from 'swiper/modules'
import { GoArrowRight, GoArrowLeft } from "react-icons/go";
import headerShape from '../../assets/header-shape.svg'
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header>
      <Swiper
        spaceBetween={50}
        slidesPerView={1}
        loop={true}
        modules={[Navigation, Pagination]}
        pagination={{ el: ".swiper-pagination", clickable: true }}
        navigation={{
          prevEl: '.button-prev-slide',
          nextEl: '.button-next-slide'
        }}
      >
        {
          headerBooks.map(({ img, title, info, epubFile }, index) => (
            <SwiperSlide key={index}>
              <div className="header-wrapper">
                <div className="header-left">
                  <h1>{title}</h1>
                  <p dangerouslySetInnerHTML={{ __html: info }}></p>
                  <Link to={`/book/${epubFile}`} className="btn btn-border" >
                    Read More
                  </Link>
                </div>

                <div className="header-right">
                  <img src={img} alt="" />
                </div>
              </div>
            </SwiperSlide>
          ))
        }

        <div className='slider-button'>
          <div className="button-prev-slide sliderbutton"><GoArrowLeft /></div>
          <div className="button-next-slide sliderbutton"><GoArrowRight /></div>
        </div>

        <div className="swiper-pagination"></div>
      </Swiper>
      <div className='header-shape'>
        <img src={headerShape} alt="Shape" />
      </div>
    </header>
  )
}
